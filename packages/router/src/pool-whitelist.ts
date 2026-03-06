import { Connection, PublicKey } from '@solana/web3.js';
import { PoolStatus } from '@accredit/types';
import type { PoolComplianceEntry } from '@accredit/types';
import { findPoolRegistryPda, findPoolEntryPda } from '@accredit/sdk';

/**
 * Manages the local whitelist cache of compliant pools synced from on-chain registry (Solana)
 */
export class PoolWhitelistManager {
  private whitelistedPools: Map<string, PoolComplianceEntry> = new Map();
  private registryProgramId: PublicKey;
  private registryAuthority: PublicKey;
  private connection: Connection;
  private lastSyncSlot: number = 0;

  constructor(
    connection: Connection,
    registryProgramId: PublicKey,
    registryAuthority: PublicKey
  ) {
    this.connection = connection;
    this.registryProgramId = registryProgramId;
    this.registryAuthority = registryAuthority;
  }

  /** Derive PDA for the pool registry */
  deriveRegistryPda(): [PublicKey, number] {
    return findPoolRegistryPda(this.registryAuthority, this.registryProgramId);
  }

  /** Derive PDA for a pool entry */
  derivePoolEntryPda(
    registryKey: PublicKey,
    ammKey: PublicKey
  ): [PublicKey, number] {
    return findPoolEntryPda(registryKey, ammKey, this.registryProgramId);
  }

  /**
   * Sync all PoolComplianceEntry accounts from on-chain registry.
   */
  async syncFromChain(): Promise<number> {
    const [registryKey] = this.deriveRegistryPda();

    const accounts = await this.connection.getProgramAccounts(
      this.registryProgramId,
      {
        filters: [
          { dataSize: 8 + 32 + 32 + 32 + (4 + 32) + 1 + 1 + 1 + 32 + 8 + 8 + 8 + 1 },
          {
            memcmp: {
              offset: 8 + 32, // skip discriminator + amm_key
              bytes: registryKey.toBase58(),
            },
          },
        ],
      }
    );

    this.whitelistedPools.clear();

    for (const { account } of accounts) {
      const entry = this.deserializePoolEntry(account.data);
      if (entry && entry.status === PoolStatus.Active) {
        this.whitelistedPools.set(entry.ammKey, entry);
      }
    }

    const slotInfo = await this.connection.getSlot();
    this.lastSyncSlot = slotInfo;

    return this.whitelistedPools.size;
  }

  /** Check if an AMM key is in the whitelist and active */
  isWhitelisted(ammKey: string): boolean {
    const entry = this.whitelistedPools.get(ammKey);
    return entry !== undefined && entry.status === PoolStatus.Active;
  }

  /** Get the compliance entry for an AMM key */
  getEntry(ammKey: string): PoolComplianceEntry | undefined {
    return this.whitelistedPools.get(ammKey);
  }

  /** Get all whitelisted AMM keys */
  getWhitelistedKeys(): string[] {
    return Array.from(this.whitelistedPools.keys());
  }

  get size(): number {
    return this.whitelistedPools.size;
  }

  get syncSlot(): number {
    return this.lastSyncSlot;
  }

  /** Manually add a pool to the whitelist (for testing or pre-population) */
  addPool(entry: PoolComplianceEntry): void {
    this.whitelistedPools.set(entry.ammKey, entry);
  }

  /** Remove a pool from the local whitelist */
  removePool(ammKey: string): boolean {
    return this.whitelistedPools.delete(ammKey);
  }

  private deserializePoolEntry(data: Buffer): PoolComplianceEntry | null {
    try {
      let offset = 8;

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
