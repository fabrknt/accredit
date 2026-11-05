import { Connection, PublicKey } from '@solana/web3.js';
import { KycLevel } from '@fabrknt/accredit-core';
import type { WhitelistEntry, ComplianceCheckResult } from '@fabrknt/accredit-core';
import { KycClient } from '@fabrknt/accredit-sdk';

/**
 * Reads transfer-hook WhitelistEntry accounts to verify trader KYC status.
 * Delegates to KycClient from @fabrknt/accredit-sdk for account fetching/deserialization.
 */
export class KycComplianceChecker {
  private kycClient: KycClient;
  private kycRegistry: PublicKey;

  /** `kycRegistry` is the transfer-hook KycRegistry whose entries count. */
  constructor(
    connection: Connection,
    transferHookProgramId: PublicKey,
    kycRegistry: PublicKey
  ) {
    this.kycClient = new KycClient(connection, transferHookProgramId);
    this.kycRegistry = kycRegistry;
  }

  /** Derive the WhitelistEntry PDA for a given wallet */
  deriveWhitelistPda(wallet: PublicKey): [PublicKey, number] {
    return this.kycClient.deriveWhitelistPda(this.kycRegistry, wallet);
  }

  /** Fetch a trader's WhitelistEntry from on-chain state */
  async getWhitelistEntry(
    trader: PublicKey
  ): Promise<WhitelistEntry | null> {
    return this.kycClient.getWhitelistEntry(this.kycRegistry, trader);
  }

  /** Check if a trader meets minimum KYC requirements */
  async checkTraderCompliance(
    trader: PublicKey,
    minKycLevel: KycLevel,
    allowedJurisdictionBitmask: number
  ): Promise<ComplianceCheckResult> {
    return this.kycClient.checkCompliance(
      this.kycRegistry,
      trader,
      minKycLevel,
      allowedJurisdictionBitmask
    );
  }

  /** Clear the entry cache */
  clearCache(trader?: PublicKey): void {
    this.kycClient.clearCache(trader ? this.kycRegistry : undefined, trader);
  }
}
