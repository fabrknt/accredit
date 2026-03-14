import { Connection, PublicKey } from '@solana/web3.js';
import { KycLevel, Jurisdiction } from '@fabrknt/accredit-core';
import {
  KycProvider,
  ProviderVerificationResult,
  VerificationSession,
  VerificationOptions,
} from '../types';

/* ------------------------------------------------------------------ */
/*  Gateway token account layout (Civic Pass)                          */
/*                                                                     */
/*  Offset  Size  Field                                                */
/*  0       1     version (u8)                                         */
/*  1       32    owner (Pubkey)                                       */
/*  33      32    issuing_gatekeeper (Pubkey)                          */
/*  65      32    gatekeeper_network (Pubkey)                          */
/*  97      1     state (u8: 0=Active, 1=Revoked, 2=Frozen)            */
/*  98      8     expiry (i64 LE, 0 = no expiry)                       */
/* ------------------------------------------------------------------ */

const GATEWAY_TOKEN_MIN_SIZE = 106;

enum GatewayTokenState {
  Active = 0,
  Revoked = 1,
  Frozen = 2,
}

interface GatewayTokenData {
  version: number;
  owner: PublicKey;
  issuingGatekeeper: PublicKey;
  gatekeeperNetwork: PublicKey;
  state: GatewayTokenState;
  expiry: number;
}

function deserializeGatewayToken(data: Buffer): GatewayTokenData {
  if (data.length < GATEWAY_TOKEN_MIN_SIZE) {
    throw new Error(
      `Gateway token data too small: ${data.length} < ${GATEWAY_TOKEN_MIN_SIZE}`,
    );
  }

  let offset = 0;

  const version = data[offset];
  offset += 1;

  const owner = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const issuingGatekeeper = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const gatekeeperNetwork = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const state = data[offset] as GatewayTokenState;
  offset += 1;

  const expiry = Number(data.readBigInt64LE(offset));

  return {
    version,
    owner,
    issuingGatekeeper,
    gatekeeperNetwork,
    state,
    expiry,
  };
}

/* ------------------------------------------------------------------ */
/*  Known Civic gatekeeper networks                                    */
/* ------------------------------------------------------------------ */

/** Well-known Civic gatekeeper network public keys mapped to pass types */
const CIVIC_PASS_TYPES: Record<string, string> = {
  // These are illustrative; real network keys would come from Civic's docs
  ignREusXmGrscGNUesoU9mxfds9AiYTezUKex2PsZV6: 'uniqueness',
  tigoYhp9SpCDoCQmXGj2im5xa3mnjR1zuXrpCJ5ZRmi: 'idVerification',
  bni1ewus6aMxTxBi5SAfzEmmXLf8KcVFRmTfproJuKw: 'liveness',
};

/**
 * Derive the gateway token PDA for a given wallet and gatekeeper network.
 *
 * Seeds: ["gateway_token", wallet_pubkey, gatekeeper_network_pubkey, [0,0,0,0,0,0,0,0]]
 *
 * The seed_offset is an 8-byte little-endian u64 defaulting to 0.
 */
function findGatewayTokenPda(
  wallet: PublicKey,
  gatekeeperNetwork: PublicKey,
): [PublicKey, number] {
  const seedOffset = Buffer.alloc(8); // 8 bytes of zeros (u64 LE = 0)
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('gateway_token'),
      wallet.toBytes(),
      gatekeeperNetwork.toBytes(),
      seedOffset,
    ],
    // Civic Gateway program ID
    new PublicKey('gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs'),
  );
}

export class CivicProvider implements KycProvider {
  readonly name = 'civic';
  private readonly connection: Connection;
  private readonly gatekeeperNetwork: PublicKey;
  private readonly passType: string;

  constructor(connection: Connection, gatekeeperNetwork: string) {
    this.connection = connection;
    this.gatekeeperNetwork = new PublicKey(gatekeeperNetwork);
    this.passType =
      CIVIC_PASS_TYPES[gatekeeperNetwork] ?? 'unknown';
  }

  async checkVerification(
    wallet: string,
  ): Promise<ProviderVerificationResult | null> {
    const walletPubkey = new PublicKey(wallet);
    const [pda] = findGatewayTokenPda(walletPubkey, this.gatekeeperNetwork);

    const accountInfo = await this.connection.getAccountInfo(pda);

    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    const token = deserializeGatewayToken(Buffer.from(accountInfo.data));

    if (token.state !== GatewayTokenState.Active) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (token.expiry > 0 && token.expiry < now) {
      return null;
    }

    const kycLevel = this.mapToKycLevel(this.passType);

    return {
      verified: true,
      provider: this.name,
      kycLevel,
      jurisdiction: Jurisdiction.Other,
      providerUserId: walletPubkey.toBase58(),
      proofData: new Uint8Array(accountInfo.data),
      expiresAt: token.expiry > 0 ? token.expiry : 0,
      metadata: {
        passType: this.passType,
        gatekeeperNetwork: this.gatekeeperNetwork.toBase58(),
        issuingGatekeeper: token.issuingGatekeeper.toBase58(),
      },
    };
  }

  async initiateVerification(
    wallet: string,
    _opts?: VerificationOptions,
  ): Promise<VerificationSession> {
    // Civic Pass verification is initiated client-side via their SDK.
    // We return a session pointing the user to the Civic Pass flow.
    const sessionId = `civic-${Date.now()}-${wallet.slice(0, 8)}`;
    return {
      sessionId,
      provider: this.name,
      wallet,
      verificationUrl: `https://getpass.civic.com/?wallet=${wallet}&network=${this.gatekeeperNetwork.toBase58()}`,
      status: 'pending',
      expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };
  }

  async validateProof(proofData: Uint8Array): Promise<boolean> {
    try {
      const token = deserializeGatewayToken(Buffer.from(proofData));
      if (token.state !== GatewayTokenState.Active) {
        return false;
      }
      const now = Math.floor(Date.now() / 1000);
      if (token.expiry > 0 && token.expiry < now) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  mapToKycLevel(providerTier: unknown): KycLevel {
    const tier = String(providerTier);
    switch (tier) {
      case 'liveness':
        return KycLevel.Basic;
      case 'idVerification':
        return KycLevel.Standard;
      case 'uniqueness':
        // uniqueness alone is Basic; combined with idVerification is Enhanced
        return KycLevel.Enhanced;
      default:
        return KycLevel.Basic;
    }
  }
}
