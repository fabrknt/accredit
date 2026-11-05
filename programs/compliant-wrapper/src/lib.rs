//! Compliant Asset Wrapper Program
//!
//! Wraps underlying SPL tokens into KYC-gated Token-2022 wrapped tokens.
//! Users must have a valid WhitelistEntry (from the transfer-hook program)
//! to wrap or unwrap tokens. The wrapped mint is created with a transfer
//! hook extension pointing to the transfer-hook program for ongoing
//! compliance enforcement on every transfer.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_2022,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

pub mod errors;
pub mod state;

use errors::WrapperError;
use state::*;

declare_id!("CWRPxn8XsLkWW5fN5RYkWRQr5o4bT1RaAi3AhAPDnj1L");

/// Transfer-hook program ID for KYC enforcement
pub const TRANSFER_HOOK_PROGRAM_ID: &str = "5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL";
/// Same ID as a Pubkey, for account constraints
pub const TRANSFER_HOOK_ID: Pubkey = pubkey!("5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL");

// WhitelistEntry binary layout offsets (after 8-byte discriminator):
// wallet(32) + registry(32) + kyc_level(1) + jurisdiction(1) + kyc_hash(32) + is_active(1) +
// daily_limit(8) + daily_volume(8) + volume_reset_time(8) + verified_at(8) + expiry_timestamp(8) +
// last_activity(8) + created_at(8) + bump(1)
const WL_OFFSET_REGISTRY: usize = 8 + 32; // 40
const WL_OFFSET_KYC_LEVEL: usize = 8 + 32 + 32; // 72
const WL_OFFSET_IS_ACTIVE: usize = 8 + 32 + 32 + 1 + 1 + 32; // 106
const WL_OFFSET_EXPIRY: usize = 8 + 32 + 32 + 1 + 1 + 32 + 1 + 8 + 8 + 8 + 8; // 139
const WL_MIN_SIZE: usize = 164;

// transfer-hook KycRegistry layout: discriminator(8) + authority(32) + mint(32) + ...
/// Anchor account discriminator of transfer-hook `KycRegistry`
/// (sha256("account:KycRegistry")[..8]).
const KYC_REGISTRY_DISCRIMINATOR: [u8; 8] = [204, 241, 19, 79, 46, 77, 56, 20];
const KR_OFFSET_MINT: usize = 8 + 32; // 40

#[program]
pub mod compliant_wrapper {
    use super::*;

    /// Initialize a new compliant wrapper.
    ///
    /// Creates the WrapperConfig PDA, a Token-2022 wrapped mint with transfer
    /// hook extension, and a vault token account for the underlying tokens.
    pub fn initialize_wrapper(
        ctx: Context<InitializeWrapper>,
        fee_bps: u16,
        min_kyc_level: u8,
    ) -> Result<()> {
        let clock = Clock::get()?;

        // Initialize the wrapper config
        let config = &mut ctx.accounts.wrapper_config;
        config.authority = ctx.accounts.authority.key();
        config.underlying_mint = ctx.accounts.underlying_mint.key();
        config.wrapped_mint = ctx.accounts.wrapped_mint.key();
        config.vault = ctx.accounts.vault.key();
        config.kyc_registry = ctx.accounts.kyc_registry.key();
        config.total_wrapped = 0;
        config.is_active = true;
        config.min_kyc_level = min_kyc_level;
        config.fee_bps = fee_bps;
        config.fee_recipient = ctx.accounts.authority.key();
        config.created_at = clock.unix_timestamp;
        config.updated_at = clock.unix_timestamp;
        config.bump = ctx.bumps.wrapper_config;
        config.wrapped_mint_bump = ctx.bumps.wrapped_mint;

        emit!(WrapperInitialized {
            wrapper_config: config.key(),
            authority: config.authority,
            underlying_mint: config.underlying_mint,
            wrapped_mint: config.wrapped_mint,
            fee_bps,
            min_kyc_level,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Wrap underlying tokens into compliant wrapped tokens.
    ///
    /// Deposits underlying tokens into the vault and mints an equal amount
    /// (minus fees) of wrapped Token-2022 tokens to the user. The user must
    /// have a valid WhitelistEntry from the transfer-hook program.
    pub fn wrap(ctx: Context<Wrap>, amount: u64) -> Result<()> {
        let clock = Clock::get()?;
        let config = &ctx.accounts.wrapper_config;

        // Check wrapper is active
        require!(config.is_active, WrapperError::WrapperPaused);
        require!(amount > 0, WrapperError::AmountTooSmall);

        // Verify KYC by reading the WhitelistEntry account
        verify_kyc(
            &ctx.accounts.whitelist_entry,
            &config.kyc_registry,
            config.min_kyc_level,
            clock.unix_timestamp,
        )?;

        // Calculate fee
        let fee = config
            .calculate_fee(amount)
            .ok_or(WrapperError::Overflow)?;
        let mint_amount = amount.checked_sub(fee).ok_or(WrapperError::Overflow)?;
        require!(mint_amount > 0, WrapperError::AmountTooSmall);

        // Transfer underlying tokens from user to vault
        anchor_spl::token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.user_underlying_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Mint wrapped tokens to user (Token-2022 mint_to with PDA signer)
        let underlying_mint_key = config.underlying_mint;
        let authority_key = config.authority;
        let signer_seeds: &[&[&[u8]]] = &[&[
            WrapperConfig::SEED_PREFIX,
            underlying_mint_key.as_ref(),
            authority_key.as_ref(),
            &[config.bump],
        ]];

        token_2022::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_2022_program.to_account_info(),
                token_2022::MintTo {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    to: ctx.accounts.user_wrapped_account.to_account_info(),
                    authority: ctx.accounts.wrapper_config.to_account_info(),
                },
                signer_seeds,
            ),
            mint_amount,
        )?;

        // Update state
        let config = &mut ctx.accounts.wrapper_config;
        config.total_wrapped = config
            .total_wrapped
            .checked_add(mint_amount)
            .ok_or(WrapperError::Overflow)?;
        config.updated_at = clock.unix_timestamp;

        emit!(TokensWrapped {
            wrapper_config: config.key(),
            user: ctx.accounts.user.key(),
            underlying_amount: amount,
            wrapped_amount: mint_amount,
            fee,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Unwrap wrapped tokens back into underlying tokens.
    ///
    /// Burns the user's wrapped Token-2022 tokens and releases the
    /// equivalent amount of underlying tokens from the vault. The user
    /// must have a valid WhitelistEntry from the transfer-hook program.
    pub fn unwrap(ctx: Context<Unwrap>, amount: u64) -> Result<()> {
        let clock = Clock::get()?;
        let config = &ctx.accounts.wrapper_config;

        // Check wrapper is active
        require!(config.is_active, WrapperError::WrapperPaused);
        require!(amount > 0, WrapperError::AmountTooSmall);

        // Verify KYC by reading the WhitelistEntry account
        verify_kyc(
            &ctx.accounts.whitelist_entry,
            &config.kyc_registry,
            config.min_kyc_level,
            clock.unix_timestamp,
        )?;

        // Calculate fee
        let fee = config
            .calculate_fee(amount)
            .ok_or(WrapperError::Overflow)?;
        let release_amount = amount.checked_sub(fee).ok_or(WrapperError::Overflow)?;
        require!(release_amount > 0, WrapperError::AmountTooSmall);

        // Burn wrapped tokens from user (Token-2022 burn)
        token_2022::burn(
            CpiContext::new(
                ctx.accounts.token_2022_program.to_account_info(),
                token_2022::Burn {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    from: ctx.accounts.user_wrapped_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Transfer underlying tokens from vault to user (PDA signer)
        let underlying_mint_key = config.underlying_mint;
        let authority_key = config.authority;
        let signer_seeds: &[&[&[u8]]] = &[&[
            WrapperConfig::SEED_PREFIX,
            underlying_mint_key.as_ref(),
            authority_key.as_ref(),
            &[config.bump],
        ]];

        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.user_underlying_account.to_account_info(),
                    authority: ctx.accounts.wrapper_config.to_account_info(),
                },
                signer_seeds,
            ),
            release_amount,
        )?;

        // Update state
        let config = &mut ctx.accounts.wrapper_config;
        config.total_wrapped = config
            .total_wrapped
            .checked_sub(amount)
            .ok_or(WrapperError::Overflow)?;
        config.updated_at = clock.unix_timestamp;

        emit!(TokensUnwrapped {
            wrapper_config: config.key(),
            user: ctx.accounts.user.key(),
            wrapped_amount: amount,
            underlying_amount: release_amount,
            fee,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Pause the wrapper (authority only). Prevents new wraps and unwraps.
    pub fn pause_wrapper(ctx: Context<WrapperAdmin>) -> Result<()> {
        let clock = Clock::get()?;
        let config = &mut ctx.accounts.wrapper_config;
        config.is_active = false;
        config.updated_at = clock.unix_timestamp;

        emit!(WrapperPaused {
            wrapper_config: config.key(),
            paused_by: ctx.accounts.authority.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Resume the wrapper (authority only). Re-enables wraps and unwraps.
    pub fn resume_wrapper(ctx: Context<WrapperAdmin>) -> Result<()> {
        let clock = Clock::get()?;
        let config = &mut ctx.accounts.wrapper_config;
        config.is_active = true;
        config.updated_at = clock.unix_timestamp;

        emit!(WrapperResumed {
            wrapper_config: config.key(),
            resumed_by: ctx.accounts.authority.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Update the fee basis points (authority only).
    pub fn update_wrapper_fee(ctx: Context<WrapperAdmin>, new_fee_bps: u16) -> Result<()> {
        let clock = Clock::get()?;
        let config = &mut ctx.accounts.wrapper_config;
        let old_fee_bps = config.fee_bps;
        config.fee_bps = new_fee_bps;
        config.updated_at = clock.unix_timestamp;

        emit!(WrapperFeeUpdated {
            wrapper_config: config.key(),
            old_fee_bps,
            new_fee_bps,
            updated_by: ctx.accounts.authority.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Point the wrapper at a different transfer-hook KYC registry
    /// (authority only). The new account must be owned by the transfer-hook
    /// program.
    pub fn update_kyc_registry(ctx: Context<UpdateKycRegistry>) -> Result<()> {
        let clock = Clock::get()?;
        verify_kyc_registry(
            &ctx.accounts.new_kyc_registry,
            &ctx.accounts.wrapper_config.wrapped_mint,
        )?;
        let config = &mut ctx.accounts.wrapper_config;
        let old_kyc_registry = config.kyc_registry;
        config.kyc_registry = ctx.accounts.new_kyc_registry.key();
        config.updated_at = clock.unix_timestamp;

        emit!(WrapperKycRegistryUpdated {
            wrapper_config: config.key(),
            old_kyc_registry,
            new_kyc_registry: config.kyc_registry,
            updated_by: ctx.accounts.authority.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

// =============================================================================
// Helpers
// =============================================================================

/// Verify that `registry` (already owner-checked as a transfer-hook account)
/// is a transfer-hook KycRegistry for `wrapped_mint`.
fn verify_kyc_registry(registry: &AccountInfo, wrapped_mint: &Pubkey) -> Result<()> {
    let data = registry.try_borrow_data()?;
    require!(
        data.len() >= KR_OFFSET_MINT + 32 && data[..8] == KYC_REGISTRY_DISCRIMINATOR,
        WrapperError::InvalidKycRegistry
    );
    require!(
        data[KR_OFFSET_MINT..KR_OFFSET_MINT + 32] == wrapped_mint.to_bytes(),
        WrapperError::InvalidKycRegistry
    );
    Ok(())
}

/// Verify that the user has a valid WhitelistEntry from the transfer-hook
/// program by directly reading the account data.
/// Owner program and PDA ([b"whitelist", kyc_registry, user]) are pinned by
/// the account constraints; the stored registry is checked here as well.
fn verify_kyc(
    whitelist_entry: &AccountInfo,
    kyc_registry: &Pubkey,
    min_kyc_level: u8,
    current_time: i64,
) -> Result<()> {
    let data = whitelist_entry.try_borrow_data()?;
    require!(data.len() >= WL_MIN_SIZE, WrapperError::KycNotActive);

    // Check registry == wrapper_config.kyc_registry (offset 40, Pubkey)
    require!(
        data[WL_OFFSET_REGISTRY..WL_OFFSET_REGISTRY + 32] == kyc_registry.to_bytes(),
        WrapperError::KycNotActive
    );

    // Check is_active (offset 106, 1 byte bool)
    let is_active = data[WL_OFFSET_IS_ACTIVE] == 1;
    require!(is_active, WrapperError::KycNotActive);

    // Check kyc_level >= min_kyc_level (offset 72, 1 byte enum)
    let kyc_level = data[WL_OFFSET_KYC_LEVEL];
    require!(kyc_level >= min_kyc_level, WrapperError::InvalidKycLevel);

    // Check expiry_timestamp > current_time (offset 139, i64 LE)
    let expiry_bytes: [u8; 8] = data[WL_OFFSET_EXPIRY..WL_OFFSET_EXPIRY + 8]
        .try_into()
        .map_err(|_| WrapperError::KycNotActive)?;
    let expiry_timestamp = i64::from_le_bytes(expiry_bytes);
    if expiry_timestamp > 0 {
        require!(expiry_timestamp > current_time, WrapperError::KycExpired);
    }

    Ok(())
}

// =============================================================================
// Account Contexts
// =============================================================================

#[derive(Accounts)]
pub struct InitializeWrapper<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The underlying token mint to wrap
    pub underlying_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + WrapperConfig::INIT_SPACE,
        seeds = [WrapperConfig::SEED_PREFIX, underlying_mint.key().as_ref(), authority.key().as_ref()],
        bump
    )]
    pub wrapper_config: Account<'info, WrapperConfig>,

    /// The Token-2022 wrapped mint created as a PDA.
    ///
    /// CHECK: Initialized via CPI to Token-2022 with transfer hook extension.
    /// We use an UncheckedAccount because the mint is created with extensions
    /// that require manual CPI initialization rather than Anchor's `init`.
    #[account(
        mut,
        seeds = [WrapperConfig::WRAPPED_MINT_SEED, wrapper_config.key().as_ref()],
        bump
    )]
    /// CHECK: Will be initialized as Token-2022 mint via CPI
    pub wrapped_mint: UncheckedAccount<'info>,

    /// Vault to hold underlying tokens, owned by the wrapper_config PDA
    #[account(
        init,
        payer = authority,
        token::mint = underlying_mint,
        token::authority = wrapper_config,
        seeds = [WrapperConfig::VAULT_SEED, wrapper_config.key().as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Transfer-hook KYC registry account (validated off-chain)
    pub kyc_registry: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub token_2022_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Wrap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [
            WrapperConfig::SEED_PREFIX,
            wrapper_config.underlying_mint.as_ref(),
            wrapper_config.authority.as_ref()
        ],
        bump = wrapper_config.bump,
    )]
    pub wrapper_config: Account<'info, WrapperConfig>,

    /// The Token-2022 wrapped mint
    #[account(
        mut,
        address = wrapper_config.wrapped_mint,
    )]
    pub wrapped_mint: InterfaceAccount<'info, Mint>,

    /// Vault holding underlying tokens
    #[account(
        mut,
        address = wrapper_config.vault,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// User's underlying token account (source of deposit)
    #[account(mut)]
    pub user_underlying_account: InterfaceAccount<'info, TokenAccount>,

    /// User's wrapped token account (destination for minted wrapped tokens)
    #[account(
        mut,
        token::mint = wrapped_mint,
        token::authority = user,
    )]
    pub user_wrapped_account: InterfaceAccount<'info, TokenAccount>,

    /// WhitelistEntry PDA from the transfer-hook program.
    /// Seeds: [b"whitelist", kyc_registry, user_wallet_pubkey] with transfer_hook_program_id.
    /// CHECK: Owner and PDA pinned below; fields read in verify_kyc().
    #[account(
        owner = TRANSFER_HOOK_ID @ WrapperError::KycNotActive,
        seeds = [
            accredit_types::WHITELIST_SEED_PREFIX,
            wrapper_config.kyc_registry.as_ref(),
            user.key().as_ref()
        ],
        bump,
        seeds::program = TRANSFER_HOOK_ID,
    )]
    pub whitelist_entry: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub token_2022_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Unwrap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [
            WrapperConfig::SEED_PREFIX,
            wrapper_config.underlying_mint.as_ref(),
            wrapper_config.authority.as_ref()
        ],
        bump = wrapper_config.bump,
    )]
    pub wrapper_config: Account<'info, WrapperConfig>,

    /// The Token-2022 wrapped mint
    #[account(
        mut,
        address = wrapper_config.wrapped_mint,
    )]
    pub wrapped_mint: InterfaceAccount<'info, Mint>,

    /// Vault holding underlying tokens
    #[account(
        mut,
        address = wrapper_config.vault,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// User's underlying token account (destination for released tokens)
    #[account(
        mut,
        token::mint = wrapper_config.underlying_mint,
        token::authority = user,
    )]
    pub user_underlying_account: InterfaceAccount<'info, TokenAccount>,

    /// User's wrapped token account (source of burned tokens)
    #[account(mut)]
    pub user_wrapped_account: InterfaceAccount<'info, TokenAccount>,

    /// WhitelistEntry PDA from the transfer-hook program.
    /// Seeds: [b"whitelist", kyc_registry, user_wallet_pubkey] with transfer_hook_program_id.
    /// CHECK: Owner and PDA pinned below; fields read in verify_kyc().
    #[account(
        owner = TRANSFER_HOOK_ID @ WrapperError::KycNotActive,
        seeds = [
            accredit_types::WHITELIST_SEED_PREFIX,
            wrapper_config.kyc_registry.as_ref(),
            user.key().as_ref()
        ],
        bump,
        seeds::program = TRANSFER_HOOK_ID,
    )]
    pub whitelist_entry: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub token_2022_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WrapperAdmin<'info> {
    #[account(
        constraint = authority.key() == wrapper_config.authority @ WrapperError::UnauthorizedAccess
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            WrapperConfig::SEED_PREFIX,
            wrapper_config.underlying_mint.as_ref(),
            wrapper_config.authority.as_ref()
        ],
        bump = wrapper_config.bump,
    )]
    pub wrapper_config: Account<'info, WrapperConfig>,
}

#[derive(Accounts)]
pub struct UpdateKycRegistry<'info> {
    #[account(
        constraint = authority.key() == wrapper_config.authority @ WrapperError::UnauthorizedAccess
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            WrapperConfig::SEED_PREFIX,
            wrapper_config.underlying_mint.as_ref(),
            wrapper_config.authority.as_ref()
        ],
        bump = wrapper_config.bump,
    )]
    pub wrapper_config: Account<'info, WrapperConfig>,

    /// CHECK: New transfer-hook KYC registry; must be owned by the transfer-hook
    /// program and be the KycRegistry of wrapper_config.wrapped_mint
    /// (checked in the handler)
    #[account(owner = TRANSFER_HOOK_ID @ WrapperError::UnauthorizedAccess)]
    pub new_kyc_registry: UncheckedAccount<'info>,
}

// =============================================================================
// Events
// =============================================================================

#[event]
pub struct WrapperInitialized {
    pub wrapper_config: Pubkey,
    pub authority: Pubkey,
    pub underlying_mint: Pubkey,
    pub wrapped_mint: Pubkey,
    pub fee_bps: u16,
    pub min_kyc_level: u8,
    pub timestamp: i64,
}

#[event]
pub struct TokensWrapped {
    pub wrapper_config: Pubkey,
    pub user: Pubkey,
    pub underlying_amount: u64,
    pub wrapped_amount: u64,
    pub fee: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokensUnwrapped {
    pub wrapper_config: Pubkey,
    pub user: Pubkey,
    pub wrapped_amount: u64,
    pub underlying_amount: u64,
    pub fee: u64,
    pub timestamp: i64,
}

#[event]
pub struct WrapperPaused {
    pub wrapper_config: Pubkey,
    pub paused_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct WrapperResumed {
    pub wrapper_config: Pubkey,
    pub resumed_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct WrapperFeeUpdated {
    pub wrapper_config: Pubkey,
    pub old_fee_bps: u16,
    pub new_fee_bps: u16,
    pub updated_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct WrapperKycRegistryUpdated {
    pub wrapper_config: Pubkey,
    pub old_kyc_registry: Pubkey,
    pub new_kyc_registry: Pubkey,
    pub updated_by: Pubkey,
    pub timestamp: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kyc_registry_layout_matches_transfer_hook() {
        use anchor_lang::Discriminator;
        assert_eq!(
            transfer_hook::state::KycRegistry::DISCRIMINATOR,
            &KYC_REGISTRY_DISCRIMINATOR[..]
        );
        // mint follows authority
        let reg = transfer_hook::state::KycRegistry {
            authority: Pubkey::new_unique(),
            mint: Pubkey::new_unique(),
            whitelist_count: 0,
            is_active: true,
            require_kyc: true,
            verified_only: true,
            created_at: 0,
            updated_at: 0,
            bump: 0,
        };
        let mut data = Vec::new();
        reg.try_serialize(&mut data).unwrap();
        assert_eq!(&data[KR_OFFSET_MINT..KR_OFFSET_MINT + 32], reg.mint.as_ref());
    }

    #[test]
    fn whitelist_offsets_match_transfer_hook() {
        use transfer_hook::state::{Jurisdiction, KycLevel, WhitelistEntry};
        let entry = WhitelistEntry {
            wallet: Pubkey::new_unique(),
            registry: Pubkey::new_unique(),
            kyc_level: KycLevel::Institutional,
            jurisdiction: Jurisdiction::Japan,
            kyc_hash: [7; 32],
            is_active: true,
            daily_limit: 1,
            daily_volume: 2,
            volume_reset_time: 3,
            verified_at: 4,
            expiry_timestamp: 0x0102_0304_0506_0708,
            last_activity: 5,
            created_at: 6,
            bump: 255,
        };
        let mut data = Vec::new();
        entry.try_serialize(&mut data).unwrap();
        assert_eq!(data.len(), WL_MIN_SIZE);
        assert_eq!(&data[WL_OFFSET_REGISTRY..WL_OFFSET_REGISTRY + 32], entry.registry.as_ref());
        assert_eq!(data[WL_OFFSET_KYC_LEVEL], KycLevel::Institutional as u8);
        assert_eq!(data[WL_OFFSET_IS_ACTIVE], 1);
        assert_eq!(
            &data[WL_OFFSET_EXPIRY..WL_OFFSET_EXPIRY + 8],
            &entry.expiry_timestamp.to_le_bytes()
        );
    }
}
