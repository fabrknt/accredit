import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { KycLevel, Jurisdiction } from '@fabrknt/accredit-core';
import { ProviderVerificationResult } from './types';

/**
 * Parameters required to call the add_to_whitelist instruction on-chain.
 */
export interface WhitelistParams {
  wallet: PublicKey;
  kycLevel: KycLevel;
  jurisdiction: Jurisdiction;
  kycHash: Uint8Array;
  expiryTimestamp: number;
}

/**
 * Bridges KYC provider verification results to Accredit's on-chain whitelist
 * format. Does NOT submit transactions -- it only builds the data that
 * the caller can pass to the SDK's add_to_whitelist instruction.
 */
export class KycProviderBridge {
  readonly connection: Connection;
  readonly transferHookProgramId: PublicKey;
  readonly authority: Keypair;

  constructor(
    connection: Connection,
    transferHookProgramId: string,
    authority: Keypair,
  ) {
    this.connection = connection;
    this.transferHookProgramId = new PublicKey(transferHookProgramId);
    this.authority = authority;
  }

  /**
   * Convert a provider verification result into parameters for the
   * add_to_whitelist on-chain instruction.
   */
  buildWhitelistParams(
    result: ProviderVerificationResult,
  ): WhitelistParams {
    const wallet = new PublicKey(result.providerUserId);
    const kycHash = this.generateKycHash(result);

    return {
      wallet,
      kycLevel: result.kycLevel,
      jurisdiction: result.jurisdiction,
      kycHash,
      expiryTimestamp: result.expiresAt,
    };
  }

  /**
   * Generate a deterministic 32-byte hash from the provider proof data.
   *
   * Uses a simple approach: SHA-256 of the concatenation of
   * provider name + providerUserId + proofData.
   *
   * This runs synchronously using Node's crypto module.
   */
  generateKycHash(result: ProviderVerificationResult): Uint8Array {
    // Use a synchronous hash approach that works in Node.js
    // We build a deterministic byte sequence and hash it
    const encoder = new TextEncoder();
    const providerBytes = encoder.encode(result.provider);
    const userIdBytes = encoder.encode(result.providerUserId);
    const proofBytes = result.proofData;

    // Combine all bytes into a single buffer
    const combined = new Uint8Array(
      providerBytes.length + userIdBytes.length + proofBytes.length,
    );
    combined.set(providerBytes, 0);
    combined.set(userIdBytes, providerBytes.length);
    combined.set(proofBytes, providerBytes.length + userIdBytes.length);

    // Use Node.js crypto for SHA-256
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(combined).digest();
    return new Uint8Array(hash);
  }
}
