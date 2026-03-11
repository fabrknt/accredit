use anchor_lang::prelude::*;

/// Configuration account for a compliant asset wrapper
#[account]
#[derive(InitSpace)]
pub struct WrapperConfig {
    /// Authority that manages this wrapper
    pub authority: Pubkey,

    /// The underlying token mint being wrapped
    pub underlying_mint: Pubkey,

    /// The Token-2022 wrapped mint (with transfer hook extension)
    pub wrapped_mint: Pubkey,

    /// Vault token account holding underlying tokens
    pub vault: Pubkey,

    /// Reference to the transfer-hook KYC registry
    pub kyc_registry: Pubkey,

    /// Total amount of tokens currently wrapped
    pub total_wrapped: u64,

    /// Whether wrapping/unwrapping is currently active
    pub is_active: bool,

    /// Minimum KycLevel enum value required (0=Basic, 1=Standard, etc.)
    pub min_kyc_level: u8,

    /// Fee in basis points (0 = no fee, 100 = 1%)
    pub fee_bps: u16,

    /// Recipient of collected fees
    pub fee_recipient: Pubkey,

    /// Creation timestamp
    pub created_at: i64,

    /// Last updated timestamp
    pub updated_at: i64,

    /// PDA bump for WrapperConfig
    pub bump: u8,

    /// PDA bump for wrapped mint
    pub wrapped_mint_bump: u8,
}

impl WrapperConfig {
    pub const SEED_PREFIX: &'static [u8] = b"wrapper_config";
    pub const WRAPPED_MINT_SEED: &'static [u8] = b"wrapped_mint";
    pub const VAULT_SEED: &'static [u8] = b"wrapper_vault";

    /// Calculate fee amount given input amount and fee_bps
    pub fn calculate_fee(&self, amount: u64) -> Option<u64> {
        if self.fee_bps == 0 {
            return Some(0);
        }
        // fee = amount * fee_bps / 10_000
        (amount as u128)
            .checked_mul(self.fee_bps as u128)?
            .checked_div(10_000)?
            .try_into()
            .ok()
    }
}
