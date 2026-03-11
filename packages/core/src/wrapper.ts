import type { KycLevel } from './kyc';

/** On-chain WrapperConfig deserialized (chain-agnostic) */
export interface WrapperConfig {
  authority: string;
  underlyingMint: string;
  wrappedMint: string;
  vault: string;
  kycRegistry: string;
  totalWrapped: bigint;
  isActive: boolean;
  minKycLevel: KycLevel;
  feeBps: number;
  feeRecipient: string;
  createdAt: bigint;
  updatedAt: bigint;
  bump: number;
  wrappedMintBump: number;
}

/** Request to wrap underlying tokens into compliant wrapped tokens */
export interface WrapRequest {
  wallet: string;
  underlyingMint: string;
  amount: bigint;
}

/** Request to unwrap compliant wrapped tokens back into underlying tokens */
export interface UnwrapRequest {
  wallet: string;
  underlyingMint: string;
  amount: bigint;
}

/** Result of a wrap or unwrap operation */
export interface WrapResult {
  success: boolean;
  wrappedAmount: bigint;
  fee: bigint;
  wrappedMint: string;
  txSignature?: string;
}
