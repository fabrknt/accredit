import { Connection, PublicKey } from '@solana/web3.js';
import { PoolStatus } from '@accredit/core';
import type { PoolComplianceEntry } from '@accredit/core';
import { findPoolRegistryPda, findPoolEntryPda } from './pda';

/**
 * Solana client for reading PoolComplianceEntry accounts from the compliant-registry program.
 */
export class RegistryClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(connection: Connection, registryProgramId: PublicKey) {
    this.connection = connection;
    this.programId = registryProgramId;
  }

  /** Derive PDA for the pool registry */
  deriveRegistryPda(authority: PublicKey): [PublicKey, number] {
    return findPoolRegistryPda(authority, this.programId);
  }

  /** Derive PDA for a pool entry */
  derivePoolEntryPda(registry: PublicKey, ammKey: PublicKey): [PublicKey, number] {
    return findPoolEntryPda(registry, ammKey, this.programId);
  }

  /** Fetch all active pool entries for a registry */
  async getActivePoolEntries(
    registryAuthority: PublicKey
  ): Promise<PoolComplianceEntry[]> {
    const [registryKey] = this.deriveRegistryPda(registryAuthority);

    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 8 + 32, // skip discriminator + amm_key
            bytes: registryKey.toBase58(),
          },
        },
      ],
    });

    const entries: PoolComplianceEntry[] = [];
    for (const { account } of accounts) {
      const entry = this.deserializePoolEntry(account.data);
      if (entry && entry.status === PoolStatus.Active) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /** Fetch a single pool entry */
  async getPoolEntry(
    registry: PublicKey,
    ammKey: PublicKey
  ): Promise<PoolComplianceEntry | null> {
    const [pda] = this.derivePoolEntryPda(registry, ammKey);
    const accountInfo = await this.connection.getAccountInfo(pda);
    if (!accountInfo) return null;
    return this.deserializePoolEntry(accountInfo.data);
  }

  private deserializePoolEntry(data: Buffer): PoolComplianceEntry | null {
    try {
      let offset = 8; // skip discriminator

      const ammKey = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const registry = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const operator = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const strLen = data.readUInt32LE(offset);
      offset += 4;
      const dexLabel = data.subarray(offset, offset + strLen).toString('utf8');
      offset += strLen;

      const status = data[offset] as PoolStatus;
      offset += 1;

      const jurisdiction = data[offset];
      offset += 1;

      const kycLevel = data[offset];
      offset += 1;

      const auditHash = new Uint8Array(data.subarray(offset, offset + 32));
      offset += 32;

      const auditExpiry = Number(data.readBigInt64LE(offset));
      offset += 8;

      const registeredAt = Number(data.readBigInt64LE(offset));
      offset += 8;

      const updatedAt = Number(data.readBigInt64LE(offset));
      offset += 8;

      return {
        ammKey,
        registry,
        operator,
        dexLabel,
        status,
        jurisdiction,
        kycLevel,
        auditHash,
        auditExpiry,
        registeredAt,
        updatedAt,
      };
    } catch {
      return null;
    }
  }
}
