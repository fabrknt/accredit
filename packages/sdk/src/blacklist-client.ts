import { Connection, PublicKey } from '@solana/web3.js';
import type { BlacklistEntry } from '@fabrknt/accredit-core';
import { findBlacklistEntryPda } from './pda';

/**
 * Solana client for reading transfer-hook blacklist accounts.
 * Handles deserialization of BlacklistEntry accounts (SSS-2 compliance).
 */
export class BlacklistClient {
  private connection: Connection;
  private programId: PublicKey;
  private cache: Map<string, BlacklistEntry> = new Map();

  constructor(connection: Connection, transferHookProgramId: PublicKey) {
    this.connection = connection;
    this.programId = transferHookProgramId;
  }

  /** Derive PDA for BlacklistEntry */
  deriveBlacklistPda(wallet: PublicKey): [PublicKey, number] {
    return findBlacklistEntryPda(wallet, this.programId);
  }

  /** Fetch a BlacklistEntry account */
  async getBlacklistEntry(wallet: PublicKey): Promise<BlacklistEntry | null> {
    const cached = this.cache.get(wallet.toBase58());
    if (cached) return cached;

    const [pda] = this.deriveBlacklistPda(wallet);
    const accountInfo = await this.connection.getAccountInfo(pda);
    if (!accountInfo) return null;

    const entry = this.deserializeBlacklistEntry(accountInfo.data);
    if (entry) {
      this.cache.set(wallet.toBase58(), entry);
    }
    return entry;
  }

  /** Check if a wallet is currently blacklisted */
  async isBlacklisted(wallet: PublicKey): Promise<{ blacklisted: boolean; reason?: string }> {
    const entry = await this.getBlacklistEntry(wallet);

    if (!entry) {
      return { blacklisted: false };
    }

    if (!entry.isActive) {
      return { blacklisted: false };
    }

    return { blacklisted: true, reason: entry.reason };
  }

  /** Clear cache */
  clearCache(wallet?: PublicKey): void {
    if (wallet) {
      this.cache.delete(wallet.toBase58());
    } else {
      this.cache.clear();
    }
  }

  private deserializeBlacklistEntry(data: Buffer): BlacklistEntry | null {
    try {
      let offset = 8; // skip discriminator

      const wallet = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const registry = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      // Borsh string: 4-byte LE length prefix + UTF-8 bytes
      const reasonLen = data.readUInt32LE(offset);
      offset += 4;
      const reason = data.subarray(offset, offset + reasonLen).toString('utf-8');
      offset += reasonLen;

      const isActive = data[offset] === 1;
      offset += 1;

      const addedBy = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const addedAt = data.readBigInt64LE(offset);
      offset += 8;

      const removedAt = data.readBigInt64LE(offset);
      offset += 8;

      const bump = data[offset];

      return {
        wallet,
        registry,
        reason,
        isActive,
        addedBy,
        addedAt,
        removedAt,
        bump,
      };
    } catch {
      return null;
    }
  }
}
