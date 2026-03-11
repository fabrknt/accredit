import { Connection, PublicKey } from '@solana/web3.js';
import type { KycLevel, WrapperConfig } from '@accredit/core';
import { findWrapperConfigPda } from './pda';

/**
 * Solana client for reading compliant-wrapper program accounts.
 * Handles deserialization of WrapperConfig accounts.
 */
export class WrapperClient {
  private connection: Connection;
  private programId: PublicKey;

  constructor(connection: Connection, wrapperProgramId: PublicKey) {
    this.connection = connection;
    this.programId = wrapperProgramId;
  }

  /** Derive PDA for WrapperConfig */
  deriveWrapperConfigPda(
    underlyingMint: PublicKey,
    authority: PublicKey
  ): [PublicKey, number] {
    return findWrapperConfigPda(underlyingMint, authority, this.programId);
  }

  /** Fetch a WrapperConfig by underlying mint and authority */
  async getWrapperConfig(
    underlyingMint: PublicKey,
    authority: PublicKey
  ): Promise<WrapperConfig | null> {
    const [pda] = this.deriveWrapperConfigPda(underlyingMint, authority);
    return this.getWrapperConfigByAddress(pda);
  }

  /** Fetch a WrapperConfig by its PDA address directly */
  async getWrapperConfigByAddress(
    address: PublicKey
  ): Promise<WrapperConfig | null> {
    const accountInfo = await this.connection.getAccountInfo(address);
    if (!accountInfo) return null;
    return this.deserializeWrapperConfig(accountInfo.data);
  }

  /** Fetch all WrapperConfig accounts owned by this program */
  async getAllWrapperConfigs(): Promise<WrapperConfig[]> {
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          // WrapperConfig discriminator: first 8 bytes
          // Filter by account size to match WrapperConfig
          dataSize: 8 + WRAPPER_CONFIG_SIZE,
        },
      ],
    });

    const configs: WrapperConfig[] = [];
    for (const { account } of accounts) {
      const config = this.deserializeWrapperConfig(account.data);
      if (config) {
        configs.push(config);
      }
    }
    return configs;
  }

  private deserializeWrapperConfig(data: Buffer): WrapperConfig | null {
    try {
      if (data.length < 8 + WRAPPER_CONFIG_SIZE) return null;

      let offset = 8; // skip discriminator

      const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const underlyingMint = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const wrappedMint = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const vault = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const kycRegistry = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const totalWrapped = data.readBigUInt64LE(offset);
      offset += 8;

      const isActive = data[offset] === 1;
      offset += 1;

      const minKycLevel = data[offset] as KycLevel;
      offset += 1;

      const feeBps = data.readUInt16LE(offset);
      offset += 2;

      const feeRecipient = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const createdAt = data.readBigInt64LE(offset);
      offset += 8;

      const updatedAt = data.readBigInt64LE(offset);
      offset += 8;

      const bump = data[offset];
      offset += 1;

      const wrappedMintBump = data[offset];

      return {
        authority,
        underlyingMint,
        wrappedMint,
        vault,
        kycRegistry,
        totalWrapped,
        isActive,
        minKycLevel,
        feeBps,
        feeRecipient,
        createdAt,
        updatedAt,
        bump,
        wrappedMintBump,
      };
    } catch {
      return null;
    }
  }
}

// WrapperConfig account data size (excluding 8-byte discriminator):
// authority(32) + underlying_mint(32) + wrapped_mint(32) + vault(32) +
// kyc_registry(32) + total_wrapped(8) + is_active(1) + min_kyc_level(1) +
// fee_bps(2) + fee_recipient(32) + created_at(8) + updated_at(8) +
// bump(1) + wrapped_mint_bump(1) = 222
const WRAPPER_CONFIG_SIZE = 222;
