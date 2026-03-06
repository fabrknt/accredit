import { Connection, PublicKey } from '@solana/web3.js';
import { KycLevel } from '@accredit/types';
import type { WhitelistEntry, ComplianceCheckResult } from '@accredit/types';
import { KycClient } from '@accredit/sdk';

/**
 * Reads transfer-hook WhitelistEntry accounts to verify trader KYC status.
 * Delegates to KycClient from @accredit/sdk for account fetching/deserialization.
 */
export class KycComplianceChecker {
  private kycClient: KycClient;

  constructor(connection: Connection, transferHookProgramId: PublicKey) {
    this.kycClient = new KycClient(connection, transferHookProgramId);
  }

  /** Derive the WhitelistEntry PDA for a given wallet */
  deriveWhitelistPda(wallet: PublicKey): [PublicKey, number] {
    return this.kycClient.deriveWhitelistPda(wallet);
  }

  /** Fetch a trader's WhitelistEntry from on-chain state */
  async getWhitelistEntry(
    trader: PublicKey
  ): Promise<WhitelistEntry | null> {
    return this.kycClient.getWhitelistEntry(trader);
  }

  /** Check if a trader meets minimum KYC requirements */
  async checkTraderCompliance(
    trader: PublicKey,
    minKycLevel: KycLevel,
    allowedJurisdictionBitmask: number
  ): Promise<ComplianceCheckResult> {
    return this.kycClient.checkCompliance(
      trader,
      minKycLevel,
      allowedJurisdictionBitmask
    );
  }

  /** Clear the entry cache */
  clearCache(trader?: PublicKey): void {
    this.kycClient.clearCache(trader);
  }
}
