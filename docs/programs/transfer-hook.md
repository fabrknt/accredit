# Transfer Hook Program

**Program ID:** `5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL`

Token-2022 transfer hook that enforces KYC/AML compliance on every token transfer. When attached to a mint, the hook validates that both sender and recipient are whitelisted, their KYC is current, their jurisdiction is allowed, and the transfer amount is within limits.

## Accounts

### KycRegistry

One registry per token mint. Controls whether transfers require KYC and tracks the total number of whitelisted wallets.

| Field | Type | Description |
|-------|------|-------------|
| `authority` | `Pubkey` | Registry admin (compliance officer) |
| `mint` | `Pubkey` | Associated token mint |
| `whitelist_count` | `u64` | Total whitelisted wallets |
| `is_active` | `bool` | Whether transfers are allowed |
| `require_kyc` | `bool` | Require KYC for all transfers |
| `verified_only` | `bool` | Only verified wallets can transfer |
| `created_at` | `i64` | Unix timestamp |
| `updated_at` | `i64` | Unix timestamp |
| `bump` | `u8` | PDA bump seed |

**PDA seeds:** `["kyc_registry", mint]`

### WhitelistEntry

One entry per wallet. Stores the wallet's KYC status, jurisdiction, and transfer limits.

| Field | Type | Description |
|-------|------|-------------|
| `wallet` | `Pubkey` | Wallet address |
| `registry` | `Pubkey` | Associated KycRegistry |
| `kyc_level` | `KycLevel` | Basic / Standard / Enhanced / Institutional |
| `jurisdiction` | `Jurisdiction` | Japan / Singapore / HongKong / Eu / Usa / Other |
| `kyc_hash` | `[u8; 32]` | Encrypted KYC data hash |
| `is_active` | `bool` | Whether the entry is active |
| `daily_limit` | `u64` | Per-day limit on what this wallet sends (0 = unlimited) |
| `daily_volume` | `u64` | Accumulated volume since last reset |
| `volume_reset_time` | `i64` | When daily volume was last reset |
| `verified_at` | `i64` | When KYC was last verified |
| `expiry_timestamp` | `i64` | When KYC expires (0 = never) |
| `last_activity` | `i64` | Last transfer timestamp |
| `created_at` | `i64` | Unix timestamp |
| `bump` | `u8` | PDA bump seed |

**PDA seeds:** `["whitelist", registry, wallet]` — an entry belongs to one registry, so each registry creates its own entries.

`wallet` is the owner of a token account, not the token account itself. The hook looks entries up by the owner stored in the source and destination token accounts.

### BlacklistEntry

One entry per registry and wallet (SSS-2). While `is_active` is true, the wallet can neither send nor receive the registry's token.

| Field | Type | Description |
|-------|------|-------------|
| `wallet` | `Pubkey` | Blocked wallet |
| `registry` | `Pubkey` | Associated KycRegistry |
| `reason` | `String` | Reason, at most 64 bytes |
| `is_active` | `bool` | Whether the entry blocks transfers |
| `added_by` | `Pubkey` | Authority that added (or reinstated) the entry |
| `added_at` | `i64` | Unix timestamp |
| `removed_at` | `i64` | When removed (0 while active) |
| `bump` | `u8` | PDA bump seed |

**PDA seeds:** `["blacklist", registry, wallet]`

## Roles

| Role | Who | Can |
|------|-----|-----|
| Mint authority / upgrade authority | Mint authority of the mint, or this program's upgrade authority | Create the mint's registry (`initialize_registry`) and name its admin |
| Registry authority (`KycRegistry.authority`) | The `admin` given at registry creation | Manage whitelist and blacklist entries, pause/resume, hand over authority, run `update_extra_account_meta_list` |
| Permanent delegate | The mint's PermanentDelegate, if set | Move tokens without the sender-side checks (see `execute`) |
| Anyone | Any payer | `initialize_extra_account_meta_list` (the list content is fixed by the program) |

## Instructions

### `initialize_registry`

Create a KYC registry for a token mint. Sets `require_kyc` and `verified_only` to `true` by default.

The signer (`authority`) must be either the mint's mint authority or this program's upgrade authority. The upgrade-authority path, which needs `program_data`, is for mints whose mint authority is a PDA of another program (for example a stablecoin or wrapper config PDA) or that have no mint authority. The `admin` argument becomes the registry authority, which manages the whitelist and blacklist; it can be a wallet or a multisig and does not have to be the signer.

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `admin` | `Pubkey` | Registry authority stored in `KycRegistry.authority` |

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | Yes | Yes | Mint authority of `mint`, or this program's upgrade authority (pays rent) |
| `mint` | No | No | Token-2022 mint |
| `registry` | No | Yes | KycRegistry PDA (initialized) |
| `program_data` | No | No | Optional. This program's ProgramData account; required when `authority` is not the mint authority. Pass the program id to omit it |
| `system_program` | No | No | System program |

### `add_to_whitelist`

Add a wallet to the whitelist with full KYC parameters.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | Yes | Yes | Registry authority (pays rent) |
| `registry` | No | Yes | KycRegistry PDA |
| `whitelist_entry` | No | Yes | WhitelistEntry PDA (initialized) |
| `system_program` | No | No | System program |

**Parameters (`AddToWhitelistParams`):**

| Field | Type | Description |
|-------|------|-------------|
| `wallet` | `Pubkey` | Wallet to whitelist |
| `kyc_level` | `KycLevel` | Verification level |
| `jurisdiction` | `Jurisdiction` | Wallet holder's jurisdiction |
| `kyc_hash` | `[u8; 32]` | Encrypted identity hash |
| `daily_limit` | `u64` | Daily sending limit (0 = unlimited) |
| `expiry_timestamp` | `i64` | KYC expiry (0 = never) |

### `remove_from_whitelist`

Deactivate a wallet's whitelist entry (sets `is_active = false`). Does not close the account; use `reinstate_whitelist` to re-activate it. The entry must be active (`EntryNotActive` otherwise).

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | Yes | No | Registry authority |
| `registry` | No | Yes | KycRegistry PDA |
| `whitelist_entry` | No | Yes | WhitelistEntry PDA |

### `reinstate_whitelist`

Re-activate a removed entry (`is_active == false`) with fresh parameters: `kyc_level`, `jurisdiction`, `kyc_hash`, `daily_limit`, `expiry_timestamp`. Resets the daily volume and `verified_at`, and counts the wallet again in `whitelist_count`. Fails with `EntryAlreadyActive` on an active entry. Same accounts as `remove_from_whitelist`.

### `add_to_blacklist`

Block a wallet for this registry (SSS-2). Creates the BlacklistEntry PDA.

**Parameters (`AddToBlacklistParams`):** `wallet: Pubkey`, `reason: String` (at most 64 bytes, `ReasonTooLong` otherwise).

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | Yes | Yes | Registry authority (pays rent) |
| `registry` | No | Yes | KycRegistry PDA |
| `blacklist_entry` | No | Yes | BlacklistEntry PDA (initialized) |
| `system_program` | No | No | System program |

### `remove_from_blacklist`

Deactivate a blacklist entry (sets `is_active = false`, records `removed_at`). The entry must be active (`NotBlacklisted` otherwise). Accounts: `authority` (signer), `registry` (writable), `blacklist_entry` (writable).

### `reinstate_blacklist`

Re-activate a removed blacklist entry with a new `reason` (at most 64 bytes). Sets `added_by`/`added_at` and clears `removed_at`. Fails with `AlreadyBlacklisted` on an active entry. Accounts: `authority` (signer), `registry` (writable), `blacklist_entry` (writable).

### `update_kyc_level`

Update KYC level, jurisdiction, and expiry for an existing whitelist entry.

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| `new_kyc_level` | `KycLevel` | Updated level |
| `new_jurisdiction` | `Jurisdiction` | Updated jurisdiction |
| `new_expiry` | `i64` | Updated expiry timestamp |

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | Yes | No | Registry authority |
| `registry` | No | No | KycRegistry PDA |
| `whitelist_entry` | No | Yes | WhitelistEntry PDA |

### `initialize_extra_account_meta_list`

Set up the Token-2022 extra account meta list for automatic transfer hook resolution. This must be called once per mint before the hook can process transfers. Any payer can call it; the list content is fixed by the program.

The full account list Token-2022 passes to `execute`, in order:

| Index | Account | Source | Writable |
|-------|---------|--------|----------|
| 0 | Source token account | Standard execute account | No |
| 1 | Mint | Standard execute account | No |
| 2 | Destination token account | Standard execute account | No |
| 3 | Owner (transfer authority: owner, delegate or permanent delegate) | Standard execute account | No |
| 4 | ExtraAccountMetaList | Standard execute account | No |
| 5 | KycRegistry | `["kyc_registry", mint]` | No |
| 6 | Sender WhitelistEntry | `["whitelist", registry, source owner]` | Yes (daily volume) |
| 7 | Recipient WhitelistEntry | `["whitelist", registry, destination owner]` | No |
| 8 | Sender BlacklistEntry | `["blacklist", registry, source owner]` (may be empty) | No |
| 9 | Recipient BlacklistEntry | `["blacklist", registry, destination owner]` (may be empty) | No |

"Owner" is the wallet stored at bytes 32..64 of the token account (`Seed::AccountData`), and `registry` is account 5 (`Seed::AccountKey { index: 5 }`). A `transfer_checked` on this mint must carry accounts 5..9, the hook program id and the meta list account after its standard accounts. `@solana/spl-token`'s `createTransferCheckedWithTransferHookInstruction` resolves them from the meta list; a program that CPIs into Token-2022 has to pass them through.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `payer` | Yes | Yes | Pays rent for meta list account |
| `mint` | No | No | Token-2022 mint |
| `extra_account_meta_list` | No | Yes | Meta list PDA (initialized) |
| `system_program` | No | No | System program |

### `update_extra_account_meta_list`

Rewrite an existing mint's meta list to the current list above (for mints whose list was created before the entry seeds included the registry). Signed by the registry authority; accounts: `authority` (signer), `mint`, `registry`, `extra_account_meta_list` (writable). The list keeps its size (five extra accounts); a list of another size fails with `InvalidExtraAccountMetaList`.

### `execute`

Main transfer hook entry point, dispatched by the SPL transfer-hook `Execute` discriminator. Validates compliance and emits `TransferValidated` (or `DelegateTransferValidated`, see below).

It only runs inside a Token-2022 transfer: the mint's TransferHook extension must point at this program and both token accounts must have the `transferring` flag set. Calling it directly fails with `NotTransferring`.

**Validation order:**
1. Mint uses this program as its hook; both token accounts are mid-transfer
2. Registry is active
3. Neither owner wallet has an active BlacklistEntry of this registry
4. Both WhitelistEntry accounts belong to this registry and to the token accounts' owner wallets
5. Sender is whitelisted and not expired
6. Sender jurisdiction is allowed
7. Sender daily volume limit not exceeded (`daily_limit` 0 = unlimited)
8. Transfer amount within sender's per-level limit
9. Recipient is whitelisted and not expired
10. Recipient jurisdiction is allowed
11. Transfer amount within recipient's per-level limit

On success, the transfer amount is added to the sender WhitelistEntry's `daily_volume` (reset after 24h), so `daily_limit` is enforced across transfers.

**Permanent delegate.** When the transfer authority (`owner`, account index 3) is the mint's PermanentDelegate, the sender-side checks (sender blacklist, steps 4-8 for the sender, daily volume) are skipped, so an SSS-2 seize works from a blacklisted or non-whitelisted holder. The recipient must still be whitelisted, allowed and not blacklisted, and the registry must be active. A regular (approved) delegate gets no exemption.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `source` | No | No | Source token account |
| `mint` | No | No | Token mint |
| `destination` | No | No | Destination token account |
| `owner` | No | No | Transfer authority (token owner or delegate) |
| `extra_account_meta_list` | No | No | Meta list |
| `registry` | No | No | KycRegistry PDA |
| `sender_whitelist` | No | Yes | WhitelistEntry PDA of the source owner wallet (daily volume is recorded here) |
| `recipient_whitelist` | No | No | WhitelistEntry PDA of the destination owner wallet |
| `sender_blacklist` | No | No | BlacklistEntry PDA of the source owner wallet (may be empty) |
| `recipient_blacklist` | No | No | BlacklistEntry PDA of the destination owner wallet (may be empty) |

### `pause_registry`

Emergency pause — sets `is_active = false` on the registry. All transfers will fail until resumed.

### `resume_registry`

Resume a paused registry — sets `is_active = true`.

### `update_registry_authority`

Transfer registry authority to a new public key.

**Admin accounts (shared by pause/resume/update_authority):**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | Yes | No | Current registry authority |
| `registry` | No | Yes | KycRegistry PDA |

## Events

| Event | Fields | Description |
|-------|--------|-------------|
| `RegistryInitialized` | mint, authority, timestamp | New registry created |
| `WalletWhitelisted` | wallet, kyc_level, jurisdiction, expiry, timestamp | Wallet added to whitelist |
| `WalletRemoved` | wallet, timestamp | Wallet deactivated |
| `KycLevelUpdated` | wallet, old_level, new_level, jurisdiction, new_expiry, timestamp | KYC level changed |
| `TransferValidated` | sender, recipient, amount, sender_kyc_level, recipient_kyc_level, timestamp | Transfer passed compliance |
| `DelegateTransferValidated` | sender, recipient, delegate, amount, recipient_kyc_level, timestamp | Transfer by the permanent delegate passed the recipient checks |
| `WalletBlacklisted` | wallet, reason, added_by, timestamp | Blacklist entry added or reinstated |
| `WalletUnblacklisted` | wallet, removed_by, timestamp | Blacklist entry removed |
| `RegistryPaused` | mint, paused_by, timestamp | Registry paused |
| `RegistryResumed` | mint, resumed_by, timestamp | Registry resumed |
| `RegistryAuthorityUpdated` | mint, old_authority, new_authority, timestamp | Authority changed |

## Error Codes

| Error | Description |
|-------|-------------|
| `Unauthorized` | Signer is not the registry authority |
| `RegistryInactive` | Registry is paused |
| `SenderNotWhitelisted` | Sender has no active whitelist entry |
| `RecipientNotWhitelisted` | Recipient has no active whitelist entry |
| `KycExpired` | KYC verification has expired |
| `DailyLimitExceeded` | Transfer would exceed daily volume limit |
| `JurisdictionNotAllowed` | Sender or recipient is in a restricted jurisdiction |
| `TransferNotAllowed` | Generic transfer denial |
| `TransferExceedsLimit` | Amount exceeds per-KYC-level transaction limit |
| `InvalidWhitelistEntry` | Whitelist entry does not belong to the token account's owner wallet |
| `SenderBlacklisted` | Sender wallet has an active blacklist entry |
| `RecipientBlacklisted` | Recipient wallet has an active blacklist entry |
| `AlreadyBlacklisted` | `reinstate_blacklist` on an active entry |
| `NotBlacklisted` | `remove_from_blacklist` on an inactive entry |
| `Overflow` | Arithmetic overflow in volume calculation |
| `InvalidExtraAccountMetaList` | Meta list account has an unexpected size |
| `EntryAlreadyActive` | `reinstate_whitelist` on an active entry |
| `ReasonTooLong` | Blacklist reason is longer than 64 bytes |
| `NotTransferring` | `execute` was called outside a Token-2022 transfer |
| `HookProgramMismatch` | The mint's TransferHook extension does not point at this program |
| `EntryNotActive` | `remove_from_whitelist` on an inactive entry |

An expired entry fails as `SenderNotWhitelisted` / `RecipientNotWhitelisted`; `KycExpired` and `TransferNotAllowed` are defined but not returned by the current instructions.

## Trade Limits by KYC Level

| KYC Level | Per-Transaction Limit | Description |
|-----------|----------------------|-------------|
| Basic | 100,000 JPY (100,000,000,000 base units) | Email + phone |
| Standard | 10,000,000 JPY (10,000,000,000,000 base units) | Government ID |
| Enhanced | 100,000,000 JPY (100,000,000,000,000 base units) | Video call + address proof |
| Institutional | Unlimited (u64::MAX) | Corporate KYC/KYB |

Base units assume 6 decimal places. The per-level limits apply to both the sender and the recipient: a transfer must fit the lower of the two levels. The daily limit (`daily_limit`) applies to the sender only.

## Deploy order for a new mint

1. Create the Token-2022 mint with the TransferHook extension pointing at this program (and PermanentDelegate if you need SSS-2 seizure).
2. `initialize_registry(admin)`, signed by the mint authority, or by this program's upgrade authority with `program_data` when the mint authority is a program PDA.
3. `initialize_extra_account_meta_list` for the mint.
4. `add_to_whitelist` for every wallet that will hold the token, including program-owned PDAs that receive it (see below).

### Program accounts that hold the token

Entries are looked up by the token account's owner. When a program PDA owns a token account (an escrow, vault or treasury), that PDA needs its own WhitelistEntry in the registry, with a KYC level whose per-level limit covers the amounts it will receive and send (`Institutional` has no per-transfer limit), an allowed jurisdiction, and `daily_limit` 0 unless you want to cap its outflow. Without it, transfers into the PDA fail with `AccountNotInitialized` on `recipient_whitelist`.

## Upgrading an existing deployment

The whitelist and blacklist entry addresses are `["whitelist" | "blacklist", registry, wallet]`. Deployments whose entries live at other addresses need the following when they move to this version:

1. **Re-create entries at the new addresses.** For each registry, create the blacklist entries first (`add_to_blacklist`), so that no blocked wallet is transferable in between, then the whitelist entries (`add_to_whitelist`) with their current KYC level, jurisdiction, daily limit and expiry. Entries at other addresses are not read by the hook.
2. **Run `update_extra_account_meta_list` for each mint**, signed by its registry authority, so Token-2022 resolves the new entry addresses. Mints whose meta list was never created run `initialize_extra_account_meta_list` instead.
3. **Upgrade the hook, the compliant wrapper and every consumer together.** Programs and clients that derive entry PDAs (the compliant wrapper, programs that read WhitelistEntry, `@fabrknt/accredit-sdk` 2.0.0 users, CPI callers that pass the extra accounts) must use the registry-scoped seeds at the same time.
4. **Whitelist program PDAs that receive the token** (escrows, vaults, treasuries) with a high enough KYC level, as described above.
