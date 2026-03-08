/** KYC verification levels (mirrors on-chain enum) */
export enum KycLevel {
  Basic = 0,
  Standard = 1,
  Enhanced = 2,
  Institutional = 3,
}

/** Jurisdiction identifiers (mirrors on-chain enum) */
export enum Jurisdiction {
  Japan = 0,
  Singapore = 1,
  HongKong = 2,
  Eu = 3,
  Usa = 4,
  Other = 5,
}

/** Supported chain identifiers */
export type Chain = "solana" | "evm";

/** Unified WhitelistEntry (chain-agnostic) */
export interface WhitelistEntry {
  wallet: string;
  registry: string;
  kycLevel: KycLevel;
  jurisdiction: Jurisdiction;
  kycHash: Uint8Array;
  isActive: boolean;
  dailyLimit: bigint;
  dailyVolume: bigint;
  volumeResetTime: bigint;
  verifiedAt: bigint;
  expiryTimestamp: bigint;
  lastActivity: bigint;
  createdAt: bigint;
  bump: number;
}

/** Unified KycRegistry */
export interface KycRegistry {
  authority: string;
  mint: string;
  whitelistCount: bigint;
  isActive: boolean;
  requireKyc: boolean;
  verifiedOnly: boolean;
  createdAt: bigint;
  updatedAt: bigint;
  bump: number;
}

/** Default per-transaction trade limits by KYC level (in smallest unit, 6 decimals) */
export const KYC_TRADE_LIMITS: Record<KycLevel, bigint> = {
  [KycLevel.Basic]: 100_000_000_000n,         // 100,000 JPY
  [KycLevel.Standard]: 10_000_000_000_000n,    // 10,000,000 JPY
  [KycLevel.Enhanced]: 100_000_000_000_000n,   // 100,000,000 JPY
  [KycLevel.Institutional]: BigInt('18446744073709551615'), // u64::MAX
};

/** Check if a jurisdiction is in a bitmask */
export function isJurisdictionInBitmask(
  jurisdiction: Jurisdiction,
  bitmask: number
): boolean {
  return ((bitmask >> jurisdiction) & 1) === 1;
}

/** Check if a jurisdiction is generally allowed */
export function isJurisdictionAllowed(jurisdiction: Jurisdiction): boolean {
  return jurisdiction !== Jurisdiction.Usa;
}

/** Blacklist entry for a sanctioned/blocked wallet (SSS-2 compliance) */
export interface BlacklistEntry {
  wallet: string;
  registry: string;
  reason: string;
  isActive: boolean;
  addedBy: string;
  addedAt: bigint;
  removedAt: bigint;
  bump: number;
}

/** Compliance check result */
export interface ComplianceCheckResult {
  isCompliant: boolean;
  reason?: string;
  entry?: WhitelistEntry;
}
