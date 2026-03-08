import { Connection, PublicKey } from '@solana/web3.js';
import type { KycLevel, Jurisdiction, WhitelistEntry, KycRegistry } from '@accredit/core';
import { findKycRegistryPda, findWhitelistEntryPda } from './pda';

/**
 * Solana client for reading transfer-hook KYC accounts.
 * Handles deserialization of WhitelistEntry and KycRegistry accounts.
 */
export class KycClient {
  private connection: Connection;
  private programId: PublicKey;
  private entryCache: Map<string, WhitelistEntry> = new Map();

  constructor(connection: Connection, transferHookProgramId: PublicKey) {
    this.connection = connection;
    this.programId = transferHookProgramId;
  }

  /** Derive PDA for KycRegistry */
  deriveRegistryPda(mint: PublicKey): [PublicKey, number] {
    return findKycRegistryPda(mint, this.programId);
  }

  /** Derive PDA for WhitelistEntry */
  deriveWhitelistPda(wallet: PublicKey): [PublicKey, number] {
    return findWhitelistEntryPda(wallet, this.programId);
  }

  /** Fetch a KycRegistry account */
  async getRegistry(mint: PublicKey): Promise<KycRegistry | null> {
    const [pda] = this.deriveRegistryPda(mint);
    const accountInfo = await this.connection.getAccountInfo(pda);
    if (!accountInfo) return null;
    return this.deserializeRegistry(accountInfo.data);
  }

  /** Fetch a WhitelistEntry account */
  async getWhitelistEntry(wallet: PublicKey): Promise<WhitelistEntry | null> {
    const walletStr = wallet.toBase58();
    const cached = this.entryCache.get(walletStr);
    if (cached) return cached;

    const [pda] = this.deriveWhitelistPda(wallet);
    const accountInfo = await this.connection.getAccountInfo(pda);
    if (!accountInfo) return null;

    const entry = this.deserializeWhitelistEntry(accountInfo.data);
    if (entry) {
      this.entryCache.set(walletStr, entry);
    }
    return entry;
  }

  /** Check trader compliance */
  async checkCompliance(
    wallet: PublicKey,
    minKycLevel: KycLevel,
    allowedJurisdictionBitmask: number
  ): Promise<{ isCompliant: boolean; reason?: string; entry?: WhitelistEntry }> {
    const entry = await this.getWhitelistEntry(wallet);

    if (!entry) {
      return { isCompliant: false, reason: 'No KYC record found' };
    }

    if (!entry.isActive) {
      return { isCompliant: false, reason: 'KYC record is inactive', entry };
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (entry.expiryTimestamp > 0n && now > entry.expiryTimestamp) {
      return { isCompliant: false, reason: 'KYC verification has expired', entry };
    }

    if (entry.kycLevel < minKycLevel) {
      return {
        isCompliant: false,
        reason: `KYC level ${entry.kycLevel} below minimum ${minKycLevel}`,
        entry,
      };
    }

    const jurisdictionBit = 1 << entry.jurisdiction;
    if ((allowedJurisdictionBitmask & jurisdictionBit) === 0) {
      return {
        isCompliant: false,
        reason: `Jurisdiction ${entry.jurisdiction} is not allowed`,
        entry,
      };
    }

    return { isCompliant: true, entry };
  }

  /** Clear cache */
  clearCache(wallet?: PublicKey): void {
    if (wallet) {
      this.entryCache.delete(wallet.toBase58());
    } else {
      this.entryCache.clear();
    }
  }

  private deserializeRegistry(data: Buffer): KycRegistry | null {
    try {
      let offset = 8; // skip discriminator

      const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const mint = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const whitelistCount = data.readBigUInt64LE(offset);
      offset += 8;

      const isActive = data[offset] === 1;
      offset += 1;

      const requireKyc = data[offset] === 1;
      offset += 1;

      const verifiedOnly = data[offset] === 1;
      offset += 1;

      const createdAt = data.readBigInt64LE(offset);
      offset += 8;

      const updatedAt = data.readBigInt64LE(offset);
      offset += 8;

      const bump = data[offset];

      return {
        authority,
        mint,
        whitelistCount,
        isActive,
        requireKyc,
        verifiedOnly,
        createdAt,
        updatedAt,
        bump,
      };
    } catch {
      return null;
    }
  }

  private deserializeWhitelistEntry(data: Buffer): WhitelistEntry | null {
    try {
      let offset = 8; // skip discriminator

      const wallet = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const registry = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const kycLevel = data[offset] as KycLevel;
      offset += 1;

      const jurisdiction = data[offset] as Jurisdiction;
      offset += 1;

      const kycHash = new Uint8Array(data.subarray(offset, offset + 32));
      offset += 32;

      const isActive = data[offset] === 1;
      offset += 1;

      const dailyLimit = data.readBigUInt64LE(offset);
      offset += 8;

      const dailyVolume = data.readBigUInt64LE(offset);
      offset += 8;

      const volumeResetTime = data.readBigInt64LE(offset);
      offset += 8;

      const verifiedAt = data.readBigInt64LE(offset);
      offset += 8;

      const expiryTimestamp = data.readBigInt64LE(offset);
      offset += 8;

      const lastActivity = data.readBigInt64LE(offset);
      offset += 8;

      const createdAt = data.readBigInt64LE(offset);
      offset += 8;

      const bump = data[offset];

      return {
        wallet,
        registry,
        kycLevel,
        jurisdiction,
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
      };
    } catch {
      return null;
    }
  }
}
