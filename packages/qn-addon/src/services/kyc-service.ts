import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "../config";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  config.transferHookProgramId,
);

/* ------------------------------------------------------------------ */
/*  PDA derivation                                                     */
/* ------------------------------------------------------------------ */

/** KycRegistry whose entries this service reads (KYC_REGISTRY env). */
function kycRegistry(): PublicKey {
  if (!config.kycRegistry) {
    throw new Error("KYC_REGISTRY is not configured");
  }
  return new PublicKey(config.kycRegistry);
}

export function findWhitelistEntryPda(
  wallet: PublicKey,
  registry: PublicKey = kycRegistry(),
  programId: PublicKey = TRANSFER_HOOK_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("whitelist"), registry.toBytes(), wallet.toBytes()],
    programId,
  );
}

export function findKycRegistryPda(
  mint: PublicKey,
  programId: PublicKey = TRANSFER_HOOK_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("kyc_registry"), mint.toBytes()],
    programId,
  );
}

/* ------------------------------------------------------------------ */
/*  KYC level / jurisdiction enums                                     */
/* ------------------------------------------------------------------ */

const KYC_LEVEL_NAMES: Record<number, string> = {
  0: "None",
  1: "Basic",
  2: "Standard",
  3: "Enhanced",
  4: "Institutional",
};

const JURISDICTION_NAMES: Record<number, string> = {
  0: "Unknown",
  1: "Japan",
  2: "Singapore",
  3: "HongKong",
  4: "US",
  5: "EU",
  6: "UK",
};

export function getKycLevelName(level: number): string {
  return KYC_LEVEL_NAMES[level] ?? `Unknown(${level})`;
}

export function getJurisdictionName(j: number): string {
  return JURISDICTION_NAMES[j] ?? `Unknown(${j})`;
}

/* ------------------------------------------------------------------ */
/*  WhitelistEntry binary layout                                       */
/*                                                                     */
/*  Offset  Size  Field                                                */
/*  0       8     discriminator                                        */
/*  8       32    wallet                                               */
/*  40      32    registry                                             */
/*  72      1     kycLevel (u8)                                        */
/*  73      1     jurisdiction (u8)                                    */
/*  74      32    kycHash                                              */
/*  106     1     isActive (bool)                                      */
/*  107     8     dailyLimit (u64 LE)                                  */
/*  115     8     dailyVolume (u64 LE)                                 */
/*  123     8     volumeResetTime (i64 LE)                             */
/*  131     8     verifiedAt (i64 LE)                                  */
/*  139     8     expiryTimestamp (i64 LE)                             */
/*  147     8     lastActivity (i64 LE)                                */
/*  155     8     createdAt (i64 LE)                                   */
/*  163     1     bump                                                 */
/*  Total:  164                                                        */
/* ------------------------------------------------------------------ */

const WHITELIST_ENTRY_SIZE = 164;

export interface WhitelistEntryData {
  wallet: string;
  registry: string;
  kycLevel: number;
  kycLevelName: string;
  jurisdiction: number;
  jurisdictionName: string;
  kycHash: string;
  isActive: boolean;
  dailyLimit: string;
  dailyVolume: string;
  volumeResetTime: number;
  verifiedAt: number;
  expiryTimestamp: number;
  lastActivity: number;
  createdAt: number;
  bump: number;
  isExpired: boolean;
}

function deserializeWhitelistEntry(data: Buffer): WhitelistEntryData {
  if (data.length < WHITELIST_ENTRY_SIZE) {
    throw new Error(
      `Account data too small: ${data.length} < ${WHITELIST_ENTRY_SIZE}`,
    );
  }

  let offset = 8; // skip discriminator

  const wallet = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  const registry = new PublicKey(
    data.subarray(offset, offset + 32),
  ).toBase58();
  offset += 32;

  const kycLevel = data[offset];
  offset += 1;

  const jurisdiction = data[offset];
  offset += 1;

  const kycHash = data.subarray(offset, offset + 32).toString("hex");
  offset += 32;

  const isActive = data[offset] === 1;
  offset += 1;

  const dailyLimit = data.readBigUInt64LE(offset).toString();
  offset += 8;

  const dailyVolume = data.readBigUInt64LE(offset).toString();
  offset += 8;

  const volumeResetTime = Number(data.readBigInt64LE(offset));
  offset += 8;

  const verifiedAt = Number(data.readBigInt64LE(offset));
  offset += 8;

  const expiryTimestamp = Number(data.readBigInt64LE(offset));
  offset += 8;

  const lastActivity = Number(data.readBigInt64LE(offset));
  offset += 8;

  const createdAt = Number(data.readBigInt64LE(offset));
  offset += 8;

  const bump = data[offset];

  const now = Math.floor(Date.now() / 1000);
  const isExpired = expiryTimestamp > 0 && expiryTimestamp < now;

  return {
    wallet,
    registry,
    kycLevel,
    kycLevelName: getKycLevelName(kycLevel),
    jurisdiction,
    jurisdictionName: getJurisdictionName(jurisdiction),
    kycHash,
    isActive,
    dailyLimit,
    dailyVolume,
    volumeResetTime,
    verifiedAt,
    expiryTimestamp,
    lastActivity,
    createdAt,
    bump,
    isExpired,
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function readWhitelistEntry(
  connection: Connection,
  walletBase58: string,
): Promise<WhitelistEntryData | null> {
  const wallet = new PublicKey(walletBase58);
  const [pda] = findWhitelistEntryPda(wallet);
  const accountInfo = await connection.getAccountInfo(pda);

  if (!accountInfo || !accountInfo.data) {
    return null;
  }

  return deserializeWhitelistEntry(Buffer.from(accountInfo.data));
}

export interface ComplianceResult {
  isCompliant: boolean;
  reason?: string;
  entry?: WhitelistEntryData;
}

export async function checkCompliance(
  connection: Connection,
  walletBase58: string,
  minKycLevel: number = 1,
  allowedJurisdictionBitmask?: number,
): Promise<ComplianceResult> {
  const entry = await readWhitelistEntry(connection, walletBase58);

  if (!entry) {
    return { isCompliant: false, reason: "No KYC entry found for wallet" };
  }

  if (!entry.isActive) {
    return {
      isCompliant: false,
      reason: "KYC entry is inactive",
      entry,
    };
  }

  if (entry.isExpired) {
    return {
      isCompliant: false,
      reason: "KYC entry has expired",
      entry,
    };
  }

  if (entry.kycLevel < minKycLevel) {
    return {
      isCompliant: false,
      reason: `KYC level ${entry.kycLevel} (${entry.kycLevelName}) is below required minimum ${minKycLevel} (${getKycLevelName(minKycLevel)})`,
      entry,
    };
  }

  if (allowedJurisdictionBitmask !== undefined) {
    const jurisdictionBit = 1 << entry.jurisdiction;
    if ((allowedJurisdictionBitmask & jurisdictionBit) === 0) {
      return {
        isCompliant: false,
        reason: `Jurisdiction ${entry.jurisdictionName} is not in the allowed bitmask`,
        entry,
      };
    }
  }

  return { isCompliant: true, entry };
}

export interface BatchComplianceResult {
  wallet: string;
  result: ComplianceResult;
}

export async function batchCheckCompliance(
  connection: Connection,
  wallets: string[],
  minKycLevel: number = 1,
  allowedJurisdictionBitmask?: number,
): Promise<BatchComplianceResult[]> {
  if (wallets.length > 100) {
    throw new Error("Batch size cannot exceed 100");
  }

  const pdas = wallets.map((w) => {
    const wallet = new PublicKey(w);
    const [pda] = findWhitelistEntryPda(wallet);
    return pda;
  });

  const accountInfos = await connection.getMultipleAccountsInfo(pdas);

  return wallets.map((walletBase58, i) => {
    const accountInfo = accountInfos[i];

    if (!accountInfo || !accountInfo.data) {
      return {
        wallet: walletBase58,
        result: {
          isCompliant: false,
          reason: "No KYC entry found for wallet",
        },
      };
    }

    const entry = deserializeWhitelistEntry(Buffer.from(accountInfo.data));

    if (!entry.isActive) {
      return {
        wallet: walletBase58,
        result: { isCompliant: false, reason: "KYC entry is inactive", entry },
      };
    }

    if (entry.isExpired) {
      return {
        wallet: walletBase58,
        result: {
          isCompliant: false,
          reason: "KYC entry has expired",
          entry,
        },
      };
    }

    if (entry.kycLevel < minKycLevel) {
      return {
        wallet: walletBase58,
        result: {
          isCompliant: false,
          reason: `KYC level ${entry.kycLevel} (${entry.kycLevelName}) is below required minimum ${minKycLevel} (${getKycLevelName(minKycLevel)})`,
          entry,
        },
      };
    }

    if (allowedJurisdictionBitmask !== undefined) {
      const jurisdictionBit = 1 << entry.jurisdiction;
      if ((allowedJurisdictionBitmask & jurisdictionBit) === 0) {
        return {
          wallet: walletBase58,
          result: {
            isCompliant: false,
            reason: `Jurisdiction ${entry.jurisdictionName} is not in the allowed bitmask`,
            entry,
          },
        };
      }
    }

    return {
      wallet: walletBase58,
      result: { isCompliant: true, entry },
    };
  });
}
