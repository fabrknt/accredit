import { PublicKey } from '@solana/web3.js';

// PDA seed constants matching on-chain program seeds
const SEEDS = {
  kycRegistry: Buffer.from('kyc_registry'),
  whitelist: Buffer.from('whitelist'),
  blacklist: Buffer.from('blacklist'),
  extraAccountMetas: Buffer.from('extra-account-metas'),
  poolRegistry: Buffer.from('pool_registry'),
  poolEntry: Buffer.from('pool_entry'),
  complianceConfig: Buffer.from('compliance_config'),
  wrapperConfig: Buffer.from('wrapper_config'),
  wrappedMint: Buffer.from('wrapped_mint'),
  wrapperVault: Buffer.from('wrapper_vault'),
} as const;

// ============================================================================
// Transfer Hook PDAs (CORE)
// ============================================================================

/** Derive PDA for KycRegistry account */
export function findKycRegistryPda(
  mint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.kycRegistry, mint.toBuffer()],
    programId
  );
}

/**
 * Derive PDA for WhitelistEntry account (seeds = [whitelist, registry, wallet]).
 * `registry` is the KycRegistry PDA (see findKycRegistryPda).
 */
export function findWhitelistEntryPda(
  registry: PublicKey,
  wallet: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.whitelist, registry.toBuffer(), wallet.toBuffer()],
    programId
  );
}

/** Derive PDA for extra account metas list (transfer hook resolution) */
export function findExtraAccountMetaListPda(
  mint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.extraAccountMetas, mint.toBuffer()],
    programId
  );
}

/**
 * Derive PDA for BlacklistEntry account (SSS-2 compliance,
 * seeds = [blacklist, registry, wallet]).
 */
export function findBlacklistEntryPda(
  registry: PublicKey,
  wallet: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.blacklist, registry.toBuffer(), wallet.toBuffer()],
    programId
  );
}

// ============================================================================
// Compliant Registry PDAs (ROUTING)
// ============================================================================

/** Derive PDA for CompliantPoolRegistry account */
export function findPoolRegistryPda(
  authority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.poolRegistry, authority.toBuffer()],
    programId
  );
}

/** Derive PDA for PoolComplianceEntry account */
export function findPoolEntryPda(
  registry: PublicKey,
  ammKey: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.poolEntry, registry.toBuffer(), ammKey.toBuffer()],
    programId
  );
}

/** Derive PDA for ComplianceConfig account */
export function findComplianceConfigPda(
  authority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.complianceConfig, authority.toBuffer()],
    programId
  );
}

// ============================================================================
// Compliant Wrapper PDAs (WRAPPING)
// ============================================================================

/** Derive PDA for WrapperConfig account */
export function findWrapperConfigPda(
  underlyingMint: PublicKey,
  authority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.wrapperConfig, underlyingMint.toBuffer(), authority.toBuffer()],
    programId
  );
}

/** Derive PDA for wrapped Token-2022 mint */
export function findWrappedMintPda(
  wrapperConfig: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.wrappedMint, wrapperConfig.toBuffer()],
    programId
  );
}

/** Derive PDA for wrapper vault token account */
export function findWrapperVaultPda(
  wrapperConfig: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.wrapperVault, wrapperConfig.toBuffer()],
    programId
  );
}

export { SEEDS as PDA_SEEDS };
