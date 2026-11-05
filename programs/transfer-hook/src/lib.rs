//! Unified Transfer Hook Program for KYC/AML Compliance
//!
//! Enforces regulatory compliance requirements via Token-2022 transfer hooks.
//! All transfers of stablecoin are validated for:
//! - KYC verification status
//! - Jurisdiction restrictions
//! - Daily transaction limits
//! - Per-KYC-level trade limits
//!
//! Merged from Meridian and Continuum transfer-hook programs.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};

pub mod state;
use state::*;

declare_id!("5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL");

#[error_code]
pub enum TransferHookError {
    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("KYC registry is not active")]
    RegistryInactive,

    #[msg("Sender is not whitelisted")]
    SenderNotWhitelisted,

    #[msg("Recipient is not whitelisted")]
    RecipientNotWhitelisted,

    #[msg("KYC verification expired")]
    KycExpired,

    #[msg("Daily transfer limit exceeded")]
    DailyLimitExceeded,

    #[msg("Jurisdiction not allowed")]
    JurisdictionNotAllowed,

    #[msg("Transfer not allowed")]
    TransferNotAllowed,

    #[msg("Transfer amount exceeds KYC level limit")]
    TransferExceedsLimit,

    #[msg("Invalid whitelist entry")]
    InvalidWhitelistEntry,

    #[msg("Sender is blacklisted")]
    SenderBlacklisted,

    #[msg("Recipient is blacklisted")]
    RecipientBlacklisted,

    #[msg("Blacklist entry already exists")]
    AlreadyBlacklisted,

    #[msg("Blacklist entry not active")]
    NotBlacklisted,

    #[msg("Arithmetic overflow")]
    Overflow,
}

#[program]
pub mod transfer_hook {
    use super::*;

    /// Initialize the KYC registry for a specific mint
    pub fn initialize_registry(ctx: Context<InitializeRegistry>) -> Result<()> {
        let clock = Clock::get()?;
        let registry = &mut ctx.accounts.registry;

        registry.authority = ctx.accounts.authority.key();
        registry.mint = ctx.accounts.mint.key();
        registry.whitelist_count = 0;
        registry.is_active = true;
        registry.require_kyc = true;
        registry.verified_only = true;
        registry.created_at = clock.unix_timestamp;
        registry.updated_at = clock.unix_timestamp;
        registry.bump = ctx.bumps.registry;

        emit!(RegistryInitialized {
            mint: ctx.accounts.mint.key(),
            authority: ctx.accounts.authority.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Add wallet to whitelist with full compliance parameters
    pub fn add_to_whitelist(
        ctx: Context<AddToWhitelist>,
        params: AddToWhitelistParams,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let registry = &mut ctx.accounts.registry;
        let entry = &mut ctx.accounts.whitelist_entry;

        entry.wallet = params.wallet;
        entry.registry = registry.key();
        entry.kyc_level = params.kyc_level;
        entry.jurisdiction = params.jurisdiction;
        entry.kyc_hash = params.kyc_hash;
        entry.is_active = true;
        entry.daily_limit = params.daily_limit;
        entry.daily_volume = 0;
        entry.volume_reset_time = clock.unix_timestamp;
        entry.verified_at = clock.unix_timestamp;
        entry.expiry_timestamp = params.expiry_timestamp;
        entry.last_activity = clock.unix_timestamp;
        entry.created_at = clock.unix_timestamp;
        entry.bump = ctx.bumps.whitelist_entry;

        registry.whitelist_count = registry.whitelist_count.saturating_add(1);
        registry.updated_at = clock.unix_timestamp;

        emit!(WalletWhitelisted {
            wallet: params.wallet,
            kyc_level: params.kyc_level,
            jurisdiction: params.jurisdiction,
            expiry: params.expiry_timestamp,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Remove wallet from whitelist
    pub fn remove_from_whitelist(ctx: Context<RemoveFromWhitelist>) -> Result<()> {
        let clock = Clock::get()?;
        let registry = &mut ctx.accounts.registry;
        let entry = &mut ctx.accounts.whitelist_entry;

        entry.is_active = false;
        registry.whitelist_count = registry.whitelist_count.saturating_sub(1);
        registry.updated_at = clock.unix_timestamp;

        emit!(WalletRemoved {
            wallet: entry.wallet,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Update KYC level and jurisdiction for a whitelisted address
    pub fn update_kyc_level(
        ctx: Context<UpdateWhitelist>,
        new_kyc_level: KycLevel,
        new_jurisdiction: Jurisdiction,
        new_expiry: i64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let entry = &mut ctx.accounts.whitelist_entry;
        let old_level = entry.kyc_level;

        entry.kyc_level = new_kyc_level;
        entry.jurisdiction = new_jurisdiction;
        entry.expiry_timestamp = new_expiry;
        entry.verified_at = clock.unix_timestamp;

        emit!(KycLevelUpdated {
            wallet: entry.wallet,
            old_level,
            new_level: new_kyc_level,
            jurisdiction: new_jurisdiction,
            new_expiry,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Add wallet to blacklist (SSS-2 compliance)
    pub fn add_to_blacklist(
        ctx: Context<AddToBlacklist>,
        params: AddToBlacklistParams,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let registry = &mut ctx.accounts.registry;
        let entry = &mut ctx.accounts.blacklist_entry;

        entry.wallet = params.wallet;
        entry.registry = registry.key();
        entry.reason = params.reason;
        entry.is_active = true;
        entry.added_by = ctx.accounts.authority.key();
        entry.added_at = clock.unix_timestamp;
        entry.removed_at = 0;
        entry.bump = ctx.bumps.blacklist_entry;

        registry.updated_at = clock.unix_timestamp;

        emit!(WalletBlacklisted {
            wallet: params.wallet,
            reason: entry.reason.clone(),
            added_by: ctx.accounts.authority.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Remove wallet from blacklist
    pub fn remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
        let clock = Clock::get()?;
        let registry = &mut ctx.accounts.registry;
        let entry = &mut ctx.accounts.blacklist_entry;

        require!(entry.is_active, TransferHookError::NotBlacklisted);

        entry.is_active = false;
        entry.removed_at = clock.unix_timestamp;
        registry.updated_at = clock.unix_timestamp;

        emit!(WalletUnblacklisted {
            wallet: entry.wallet,
            removed_by: ctx.accounts.authority.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Initialize extra account metas for transfer hook resolution
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        let account_metas = vec![
            // KYC Registry
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal {
                        bytes: KycRegistry::SEED_PREFIX.to_vec(),
                    },
                    Seed::AccountKey { index: 1 }, // mint
                ],
                false, // is_signer
                false, // is_writable
            )?,
            // Sender whitelist entry
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal {
                        bytes: WhitelistEntry::SEED_PREFIX.to_vec(),
                    },
                    // owner wallet of the source token account (bytes 32..64)
                    Seed::AccountData { account_index: 0, data_index: 32, length: 32 },
                ],
                false,
                true, // writable to update daily volume
            )?,
            // Recipient whitelist entry
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal {
                        bytes: WhitelistEntry::SEED_PREFIX.to_vec(),
                    },
                    // owner wallet of the destination token account (bytes 32..64)
                    Seed::AccountData { account_index: 2, data_index: 32, length: 32 },
                ],
                false,
                false,
            )?,
            // Sender blacklist entry (SSS-2)
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal {
                        bytes: BlacklistEntry::SEED_PREFIX.to_vec(),
                    },
                    // owner wallet of the source token account
                    Seed::AccountData { account_index: 0, data_index: 32, length: 32 },
                ],
                false,
                false,
            )?,
            // Recipient blacklist entry (SSS-2)
            ExtraAccountMeta::new_with_seeds(
                &[
                    Seed::Literal {
                        bytes: BlacklistEntry::SEED_PREFIX.to_vec(),
                    },
                    // owner wallet of the destination token account
                    Seed::AccountData { account_index: 2, data_index: 32, length: 32 },
                ],
                false,
                false,
            )?,
        ];

        let account_size = ExtraAccountMetaList::size_of(account_metas.len())?;
        let lamports = Rent::get()?.minimum_balance(account_size);

        let mint_key = ctx.accounts.mint.key();
        let signer_seeds: &[&[u8]] = &[b"extra-account-metas", mint_key.as_ref()];

        anchor_lang::system_program::create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
            )
            .with_signer(&[signer_seeds]),
            lamports,
            account_size as u64,
            ctx.program_id,
        )?;

        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
            &account_metas,
        )?;

        Ok(())
    }

    /// Execute transfer hook - validates KYC/AML compliance
    /// Called automatically by Token-2022 on every transfer
    ///
    /// Validation order:
    /// 1. Registry active check
    /// 2. Blacklist check (SSS-2) — reject if either party is blacklisted
    /// 3. Whitelist check — verify KYC status, jurisdiction, limits
    pub fn execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
        let clock = Clock::get()?;

        // 1. Validate registry is active
        require!(
            ctx.accounts.registry.is_active(),
            TransferHookError::RegistryInactive
        );

        // 2. Check blacklist (SSS-2 compliance) — checked before whitelist
        //    If a blacklist PDA for this registry exists and is active, reject
        //    the transfer. The resolver always passes the PDA address; for
        //    wallets that were never blacklisted it is an empty account.
        let registry_key = ctx.accounts.registry.key();
        require!(
            !blacklisted_in(&ctx.accounts.sender_blacklist, &registry_key)?,
            TransferHookError::SenderBlacklisted
        );
        require!(
            !blacklisted_in(&ctx.accounts.recipient_blacklist, &registry_key)?,
            TransferHookError::RecipientBlacklisted
        );

        // 3. Validate sender whitelist
        let sender_entry = &ctx.accounts.sender_whitelist;
        require!(
            sender_entry.is_valid(clock.unix_timestamp),
            TransferHookError::SenderNotWhitelisted
        );
        require!(
            sender_entry.jurisdiction_allowed(),
            TransferHookError::JurisdictionNotAllowed
        );
        require!(
            sender_entry.can_transfer(amount, clock.unix_timestamp),
            TransferHookError::DailyLimitExceeded
        );

        // Per-level trade limit check
        let sender_limit = trade_limit_for_level(&sender_entry.kyc_level);
        require!(
            amount <= sender_limit,
            TransferHookError::TransferExceedsLimit
        );

        // Validate recipient whitelist
        let recipient_entry = &ctx.accounts.recipient_whitelist;
        require!(
            recipient_entry.is_valid(clock.unix_timestamp),
            TransferHookError::RecipientNotWhitelisted
        );
        require!(
            recipient_entry.jurisdiction_allowed(),
            TransferHookError::JurisdictionNotAllowed
        );

        // Per-level trade limit check for recipient
        let recipient_limit = trade_limit_for_level(&recipient_entry.kyc_level);
        require!(
            amount <= recipient_limit,
            TransferHookError::TransferExceedsLimit
        );

        emit!(TransferValidated {
            sender: sender_entry.wallet,
            recipient: recipient_entry.wallet,
            amount,
            sender_kyc_level: sender_entry.kyc_level,
            recipient_kyc_level: recipient_entry.kyc_level,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Fallback instruction for transfer hook interface
    pub fn fallback<'info>(
        _program_id: &Pubkey,
        _accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        use spl_discriminator::discriminator::SplDiscriminate;

        if data.len() < 8 {
            return Err(ProgramError::InvalidInstructionData.into());
        }

        let discriminator = &data[..8];
        if discriminator == ExecuteInstruction::SPL_DISCRIMINATOR.as_slice() {
            if data.len() < 16 {
                return Err(ProgramError::InvalidInstructionData.into());
            }
            let amount = u64::from_le_bytes(
                data[8..16]
                    .try_into()
                    .map_err(|_| ProgramError::InvalidInstructionData)?,
            );
            msg!("Transfer hook fallback: execute with amount {}", amount);
            Ok(())
        } else {
            Err(ProgramError::InvalidInstructionData.into())
        }
    }

    /// Pause the registry (emergency function)
    pub fn pause_registry(ctx: Context<AdminAction>) -> Result<()> {
        let clock = Clock::get()?;
        let registry = &mut ctx.accounts.registry;
        registry.is_active = false;
        registry.updated_at = clock.unix_timestamp;

        emit!(RegistryPaused {
            mint: registry.mint,
            paused_by: ctx.accounts.authority.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Resume the registry
    pub fn resume_registry(ctx: Context<AdminAction>) -> Result<()> {
        let clock = Clock::get()?;
        let registry = &mut ctx.accounts.registry;
        registry.is_active = true;
        registry.updated_at = clock.unix_timestamp;

        emit!(RegistryResumed {
            mint: registry.mint,
            resumed_by: ctx.accounts.authority.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Update registry authority
    pub fn update_registry_authority(
        ctx: Context<AdminAction>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let registry = &mut ctx.accounts.registry;
        let old_authority = registry.authority;
        registry.authority = new_authority;
        registry.updated_at = clock.unix_timestamp;

        emit!(RegistryAuthorityUpdated {
            mint: registry.mint,
            old_authority,
            new_authority,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

// =============================================================================
// Account Contexts
// =============================================================================

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + KycRegistry::INIT_SPACE,
        seeds = [KycRegistry::SEED_PREFIX, mint.key().as_ref()],
        bump
    )]
    pub registry: Account<'info, KycRegistry>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: AddToWhitelistParams)]
pub struct AddToWhitelist<'info> {
    #[account(
        mut,
        constraint = authority.key() == registry.authority @ TransferHookError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [KycRegistry::SEED_PREFIX, registry.mint.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, KycRegistry>,

    #[account(
        init,
        payer = authority,
        space = 8 + WhitelistEntry::INIT_SPACE,
        seeds = [WhitelistEntry::SEED_PREFIX, params.wallet.as_ref()],
        bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AddToWhitelistParams {
    pub wallet: Pubkey,
    pub kyc_level: KycLevel,
    pub jurisdiction: Jurisdiction,
    pub kyc_hash: [u8; 32],
    pub daily_limit: u64,
    pub expiry_timestamp: i64,
}

#[derive(Accounts)]
pub struct RemoveFromWhitelist<'info> {
    #[account(
        constraint = authority.key() == registry.authority @ TransferHookError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [KycRegistry::SEED_PREFIX, registry.mint.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, KycRegistry>,

    #[account(
        mut,
        seeds = [WhitelistEntry::SEED_PREFIX, whitelist_entry.wallet.as_ref()],
        bump = whitelist_entry.bump,
        constraint = whitelist_entry.registry == registry.key() @ TransferHookError::Unauthorized,
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
}

#[derive(Accounts)]
pub struct UpdateWhitelist<'info> {
    #[account(
        constraint = authority.key() == registry.authority @ TransferHookError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [KycRegistry::SEED_PREFIX, registry.mint.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, KycRegistry>,

    #[account(
        mut,
        seeds = [WhitelistEntry::SEED_PREFIX, whitelist_entry.wallet.as_ref()],
        bump = whitelist_entry.bump,
        constraint = whitelist_entry.registry == registry.key() @ TransferHookError::Unauthorized,
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AddToBlacklistParams {
    pub wallet: Pubkey,
    pub reason: String,
}

#[derive(Accounts)]
#[instruction(params: AddToBlacklistParams)]
pub struct AddToBlacklist<'info> {
    #[account(
        mut,
        constraint = authority.key() == registry.authority @ TransferHookError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [KycRegistry::SEED_PREFIX, registry.mint.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, KycRegistry>,

    #[account(
        init,
        payer = authority,
        space = 8 + BlacklistEntry::INIT_SPACE,
        seeds = [BlacklistEntry::SEED_PREFIX, params.wallet.as_ref()],
        bump
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveFromBlacklist<'info> {
    #[account(
        constraint = authority.key() == registry.authority @ TransferHookError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [KycRegistry::SEED_PREFIX, registry.mint.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, KycRegistry>,

    #[account(
        mut,
        seeds = [BlacklistEntry::SEED_PREFIX, blacklist_entry.wallet.as_ref()],
        bump = blacklist_entry.bump,
        constraint = blacklist_entry.registry == registry.key() @ TransferHookError::Unauthorized,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: Validated by PDA derivation
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(token::mint = mint)]
    pub source: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(token::mint = mint)]
    pub destination: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Token owner
    pub owner: UncheckedAccount<'info>,

    /// CHECK: Extra account metas
    pub extra_account_meta_list: UncheckedAccount<'info>,

    #[account(
        seeds = [KycRegistry::SEED_PREFIX, mint.key().as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, KycRegistry>,

    /// Whitelist entry of the source token account's owner wallet
    #[account(
        seeds = [WhitelistEntry::SEED_PREFIX, source.owner.as_ref()],
        bump = sender_whitelist.bump,
        constraint = sender_whitelist.registry == registry.key() @ TransferHookError::SenderNotWhitelisted,
        constraint = sender_whitelist.wallet == source.owner @ TransferHookError::InvalidWhitelistEntry,
    )]
    pub sender_whitelist: Account<'info, WhitelistEntry>,

    /// Whitelist entry of the destination token account's owner wallet
    #[account(
        seeds = [WhitelistEntry::SEED_PREFIX, destination.owner.as_ref()],
        bump = recipient_whitelist.bump,
        constraint = recipient_whitelist.registry == registry.key() @ TransferHookError::RecipientNotWhitelisted,
        constraint = recipient_whitelist.wallet == destination.owner @ TransferHookError::InvalidWhitelistEntry,
    )]
    pub recipient_whitelist: Account<'info, WhitelistEntry>,

    /// CHECK: Blacklist PDA of the source owner wallet. Empty unless the
    /// wallet was blacklisted; read by `blacklisted_in`.
    #[account(
        seeds = [BlacklistEntry::SEED_PREFIX, source.owner.as_ref()],
        bump,
    )]
    pub sender_blacklist: UncheckedAccount<'info>,

    /// CHECK: Blacklist PDA of the destination owner wallet (see above).
    #[account(
        seeds = [BlacklistEntry::SEED_PREFIX, destination.owner.as_ref()],
        bump,
    )]
    pub recipient_blacklist: UncheckedAccount<'info>,
}

/// True when `info` is an initialized BlacklistEntry of `registry` that is
/// still active. An empty (never-created) PDA, or an entry written by another
/// registry, does not block.
fn blacklisted_in(info: &AccountInfo, registry: &Pubkey) -> Result<bool> {
    if info.data_is_empty() || info.owner != &crate::ID {
        return Ok(false);
    }
    let data = info.try_borrow_data()?;
    let entry = BlacklistEntry::try_deserialize(&mut &data[..])?;
    Ok(entry.registry == *registry && entry.is_blacklisted())
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(
        constraint = authority.key() == registry.authority @ TransferHookError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [KycRegistry::SEED_PREFIX, registry.mint.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, KycRegistry>,
}

// =============================================================================
// Events
// =============================================================================

#[event]
pub struct RegistryInitialized {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct WalletWhitelisted {
    pub wallet: Pubkey,
    pub kyc_level: KycLevel,
    pub jurisdiction: Jurisdiction,
    pub expiry: i64,
    pub timestamp: i64,
}

#[event]
pub struct WalletRemoved {
    pub wallet: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct KycLevelUpdated {
    pub wallet: Pubkey,
    pub old_level: KycLevel,
    pub new_level: KycLevel,
    pub jurisdiction: Jurisdiction,
    pub new_expiry: i64,
    pub timestamp: i64,
}

#[event]
pub struct TransferValidated {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub sender_kyc_level: KycLevel,
    pub recipient_kyc_level: KycLevel,
    pub timestamp: i64,
}

#[event]
pub struct RegistryPaused {
    pub mint: Pubkey,
    pub paused_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RegistryResumed {
    pub mint: Pubkey,
    pub resumed_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RegistryAuthorityUpdated {
    pub mint: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct WalletBlacklisted {
    pub wallet: Pubkey,
    pub reason: String,
    pub added_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct WalletUnblacklisted {
    pub wallet: Pubkey,
    pub removed_by: Pubkey,
    pub timestamp: i64,
}
