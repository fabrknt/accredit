# Compliant Wrapper Program

Program ID: `CWRPxn8XsLkWW5fN5RYkWRQr5o4bT1RaAi3AhAPDnj1L`

Wraps existing SPL tokens into KYC-gated Token-2022 equivalents with transfer hook enforcement. Enables pulling existing liquidity (USDC, SOL, etc.) into the compliance layer without requiring token issuers to modify their mints.

## How It Works

1. An operator initializes a wrapper for an underlying token (e.g., USDC)
2. The program creates a Token-2022 wrapped mint (cUSDC) with the transfer hook extension pointing to the transfer-hook program
3. KYC-verified users deposit underlying tokens and receive wrapped tokens 1:1 (minus optional fee)
4. All transfers of wrapped tokens are automatically validated by the transfer hook
5. Users can unwrap at any time, burning wrapped tokens to receive underlying tokens

## Account Structure

```
WrapperConfig (per underlying mint + authority)
  PDA: ["wrapper_config", underlying_mint, authority]
  ├── authority: Pubkey
  ├── underlying_mint: Pubkey       (e.g., USDC mint)
  ├── wrapped_mint: Pubkey          (e.g., cUSDC Token-2022 mint)
  ├── vault: Pubkey                 (token account holding underlying)
  ├── kyc_registry: Pubkey          (transfer-hook KYC registry reference)
  ├── total_wrapped: u64            (current wrapped supply)
  ├── is_active: bool               (pause mechanism)
  ├── min_kyc_level: u8             (minimum KycLevel for wrap/unwrap)
  ├── fee_bps: u16                  (fee in basis points, 0 = no fee)
  ├── fee_recipient: Pubkey
  ├── created_at: i64
  ├── updated_at: i64
  ├── bump: u8
  └── wrapped_mint_bump: u8

Wrapped Mint (Token-2022 with TransferHookExtension)
  PDA: ["wrapped_mint", wrapper_config]

Vault (SPL token account holding underlying)
  PDA: ["wrapper_vault", wrapper_config]
```

## PDA Derivation

| Account | Seeds | Program |
|---------|-------|---------|
| WrapperConfig | `["wrapper_config", underlying_mint, authority]` | compliant-wrapper |
| Wrapped Mint | `["wrapped_mint", wrapper_config]` | compliant-wrapper |
| Vault | `["wrapper_vault", wrapper_config]` | compliant-wrapper |

## Instructions

### `initialize_wrapper`

Creates the wrapper configuration, Token-2022 wrapped mint, and vault.

**Parameters:**
- `fee_bps: u16` — Fee in basis points (100 = 1%)
- `min_kyc_level: u8` — Minimum KycLevel enum value (0=Basic, 1=Standard, 2=Enhanced, 3=Institutional)

**Accounts:**
- `authority` (signer, mut) — Wrapper administrator
- `underlying_mint` — The existing token mint to wrap
- `wrapper_config` (init) — WrapperConfig PDA
- `wrapped_mint` (init) — Token-2022 mint with transfer hook extension
- `vault` (init) — Token account for underlying assets, owned by wrapper_config PDA
- `kyc_registry` — Transfer-hook KYC registry for the underlying mint
- `token_program`, `token_2022_program`, `associated_token_program`, `system_program`, `rent`

### `wrap`

Deposits underlying tokens and mints wrapped tokens to the user.

**Parameters:**
- `amount: u64` — Amount of underlying tokens to wrap

**Flow:**
1. Verify wrapper is active
2. Read user's WhitelistEntry PDA from transfer-hook program
3. Check: `is_active`, `kyc_level >= min_kyc_level`, `expiry_timestamp > now`
4. Calculate fee: `fee = amount * fee_bps / 10000`
5. Transfer underlying tokens from user to vault (SPL transfer)
6. Mint `amount - fee` wrapped tokens to user (Token-2022 mint_to with PDA signer)

**Accounts:**
- `user` (signer, mut) — The user wrapping tokens
- `wrapper_config` (mut) — WrapperConfig PDA
- `wrapped_mint` (mut) — Token-2022 wrapped mint
- `vault` (mut) — Underlying token vault
- `user_underlying_account` (mut) — User's underlying token account
- `user_wrapped_account` (mut) — User's wrapped token account
- `whitelist_entry` — User's WhitelistEntry PDA from transfer-hook program
- `token_program`, `token_2022_program`

### `unwrap`

Burns wrapped tokens and releases underlying tokens from vault.

**Parameters:**
- `amount: u64` — Amount of wrapped tokens to burn

**Flow:**
1. Verify wrapper is active
2. Verify user's KYC (same as wrap)
3. Calculate fee: `fee = amount * fee_bps / 10000`
4. Burn wrapped tokens from user (Token-2022 burn)
5. Transfer `amount - fee` underlying tokens from vault to user (SPL transfer with PDA signer)

**Accounts:** Same as `wrap`.

### `pause_wrapper`

Pauses the wrapper, preventing new wraps and unwraps. Authority only.

### `resume_wrapper`

Resumes a paused wrapper. Authority only.

### `update_wrapper_fee`

Updates the fee basis points. Authority only.

**Parameters:**
- `new_fee_bps: u16` — New fee in basis points

## Events

| Event | Fields |
|-------|--------|
| `WrapperInitialized` | wrapper_config, authority, underlying_mint, wrapped_mint, fee_bps, min_kyc_level, timestamp |
| `TokensWrapped` | wrapper_config, user, underlying_amount, wrapped_amount, fee, timestamp |
| `TokensUnwrapped` | wrapper_config, user, wrapped_amount, underlying_amount, fee, timestamp |
| `WrapperPaused` | wrapper_config, paused_by, timestamp |
| `WrapperResumed` | wrapper_config, resumed_by, timestamp |
| `WrapperFeeUpdated` | wrapper_config, old_fee_bps, new_fee_bps, updated_by, timestamp |

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | WrapperPaused | Wrapper is paused |
| 6001 | InsufficientBalance | Insufficient balance |
| 6002 | UnauthorizedAccess | Unauthorized access |
| 6003 | InvalidKycLevel | KYC level does not meet minimum requirement |
| 6004 | KycExpired | KYC verification has expired |
| 6005 | KycNotActive | KYC entry is not active |
| 6006 | AmountTooSmall | Amount is too small |
| 6007 | Overflow | Arithmetic overflow |

## KYC Verification

The wrapper program reads the WhitelistEntry account directly from the transfer-hook program without CPI. It parses the binary account data at known offsets:

| Field | Offset | Size | Check |
|-------|--------|------|-------|
| `is_active` | 106 | 1 byte | Must be `true` |
| `kyc_level` | 72 | 1 byte | Must be `>= min_kyc_level` |
| `expiry_timestamp` | 139 | 8 bytes (i64 LE) | Must be `> current_time` (or 0 for no expiry) |

The WhitelistEntry PDA is derived with seeds `["whitelist", user_wallet]` under the transfer-hook program ID.
