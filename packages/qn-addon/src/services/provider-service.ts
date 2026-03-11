import { Connection } from "@solana/web3.js";
import { config } from "../config";

/* ------------------------------------------------------------------ */
/*  KYC enums (mirrored from @accredit/core to avoid hard dependency)  */
/* ------------------------------------------------------------------ */

enum KycLevel {
  Basic = 0,
  Standard = 1,
  Enhanced = 2,
  Institutional = 3,
}

enum Jurisdiction {
  Japan = 0,
  Singapore = 1,
  HongKong = 2,
  Eu = 3,
  Usa = 4,
  Other = 5,
}

/* ------------------------------------------------------------------ */
/*  Types (inline to avoid hard dep on @accredit/kyc-providers at      */
/*  runtime — the qn-addon may be deployed independently)              */
/* ------------------------------------------------------------------ */

export interface ProviderVerificationResult {
  verified: boolean;
  provider: string;
  kycLevel: KycLevel;
  jurisdiction: Jurisdiction;
  providerUserId: string;
  proofData: string; // hex-encoded for JSON transport
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export interface ProviderInfo {
  name: string;
  enabled: boolean;
  description: string;
}

export type AggregationStrategy = "any" | "all" | "majority" | "highest";

export interface AggregateRequest {
  wallet: string;
  strategy: AggregationStrategy;
  providers: string[];
}

export interface AggregateResult {
  verified: boolean;
  kycLevel: KycLevel;
  jurisdiction: Jurisdiction;
  results: ProviderVerificationResult[];
  strategy: AggregationStrategy;
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/*  Available providers                                                */
/* ------------------------------------------------------------------ */

const PROVIDERS: ProviderInfo[] = [
  {
    name: "civic",
    enabled: !!config.civicGatekeeperNetwork,
    description: "Civic Pass — on-chain gateway tokens for identity verification",
  },
  {
    name: "worldcoin",
    enabled: !!(config.worldcoinAppId && config.worldcoinActionId),
    description: "World ID — zero-knowledge proof of personhood",
  },
];

/* ------------------------------------------------------------------ */
/*  Provider service                                                   */
/* ------------------------------------------------------------------ */

export function listProviders(): ProviderInfo[] {
  return PROVIDERS;
}

export async function checkProviderVerification(
  connection: Connection,
  providerName: string,
  wallet: string,
): Promise<ProviderVerificationResult | null> {
  switch (providerName) {
    case "civic":
      return checkCivicVerification(connection, wallet);
    case "worldcoin":
      return checkWorldcoinVerification(wallet);
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

export async function aggregateVerification(
  connection: Connection,
  request: AggregateRequest,
): Promise<AggregateResult> {
  const { wallet, strategy, providers } = request;

  const settled = await Promise.allSettled(
    providers.map((p) => checkProviderVerification(connection, p, wallet)),
  );

  const results: ProviderVerificationResult[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value !== null) {
      results.push(s.value);
    }
  }

  const verified = results.filter((r) => r.verified);

  let isVerified = false;
  let kycLevel: KycLevel = KycLevel.Basic;
  let jurisdiction: Jurisdiction = Jurisdiction.Other;

  switch (strategy) {
    case "any":
      isVerified = verified.length > 0;
      if (isVerified) {
        kycLevel = verified[0].kycLevel;
        jurisdiction = verified[0].jurisdiction;
      }
      break;

    case "all":
      isVerified = verified.length === providers.length && verified.length > 0;
      if (isVerified) {
        kycLevel = Math.min(...verified.map((r) => r.kycLevel)) as KycLevel;
        jurisdiction = verified[0].jurisdiction;
      }
      break;

    case "majority": {
      const threshold = Math.ceil(providers.length / 2);
      isVerified = verified.length >= threshold;
      if (isVerified) {
        kycLevel = Math.min(...verified.map((r) => r.kycLevel)) as KycLevel;
        jurisdiction = verified[0].jurisdiction;
      }
      break;
    }

    case "highest":
      isVerified = verified.length > 0;
      if (isVerified) {
        const highest = verified.reduce((max, r) =>
          r.kycLevel > max.kycLevel ? r : max,
        );
        kycLevel = highest.kycLevel;
        jurisdiction = highest.jurisdiction;
      }
      break;
  }

  return {
    verified: isVerified,
    kycLevel,
    jurisdiction,
    results,
    strategy,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/* ------------------------------------------------------------------ */
/*  Provider-specific checks                                           */
/* ------------------------------------------------------------------ */

async function checkCivicVerification(
  connection: Connection,
  wallet: string,
): Promise<ProviderVerificationResult | null> {
  const { PublicKey } = await import("@solana/web3.js");

  const gatekeeperNetwork = config.civicGatekeeperNetwork;
  if (!gatekeeperNetwork) {
    throw new Error("Civic gatekeeper network is not configured");
  }

  const walletPubkey = new PublicKey(wallet);
  const networkPubkey = new PublicKey(gatekeeperNetwork);

  // Derive gateway token PDA
  const seedOffset = Buffer.alloc(8);
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("gateway_token"),
      walletPubkey.toBytes(),
      networkPubkey.toBytes(),
      seedOffset,
    ],
    new PublicKey("gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs"),
  );

  const accountInfo = await connection.getAccountInfo(pda);

  if (!accountInfo || !accountInfo.data) {
    return null;
  }

  const data = Buffer.from(accountInfo.data);
  if (data.length < 106) {
    return null;
  }

  // Parse gateway token: state at offset 97
  const state = data[97];
  if (state !== 0) {
    // 0 = Active
    return null;
  }

  const expiry = Number(data.readBigInt64LE(98));
  const now = Math.floor(Date.now() / 1000);
  if (expiry > 0 && expiry < now) {
    return null;
  }

  return {
    verified: true,
    provider: "civic",
    kycLevel: KycLevel.Standard,
    jurisdiction: Jurisdiction.Other,
    providerUserId: wallet,
    proofData: data.toString("hex"),
    expiresAt: expiry > 0 ? expiry : 0,
    metadata: {
      gatekeeperNetwork,
      pda: pda.toBase58(),
    },
  };
}

async function checkWorldcoinVerification(
  wallet: string,
): Promise<ProviderVerificationResult | null> {
  const { worldcoinAppId, worldcoinActionId, worldcoinApiUrl } = config;

  if (!worldcoinAppId || !worldcoinActionId) {
    throw new Error("Worldcoin app ID and action ID are not configured");
  }

  try {
    const url = `${worldcoinApiUrl}/api/v1/verify/${worldcoinAppId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: worldcoinActionId,
        signal: wallet,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;

    if (!data.success) {
      return null;
    }

    const proofString = JSON.stringify({
      nullifier_hash: data.nullifier_hash,
      merkle_root: data.merkle_root,
      proof: data.proof,
      credential_type: data.credential_type,
    });

    return {
      verified: true,
      provider: "worldcoin",
      kycLevel: KycLevel.Basic,
      jurisdiction: Jurisdiction.Other,
      providerUserId: (data.nullifier_hash as string) ?? wallet,
      proofData: Buffer.from(proofString).toString("hex"),
      expiresAt: 0,
      metadata: {
        nullifierHash: data.nullifier_hash as string,
        credentialType: data.credential_type as string,
      },
    };
  } catch {
    return null;
  }
}
