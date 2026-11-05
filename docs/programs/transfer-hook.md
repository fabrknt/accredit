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
| `daily_limit` | `u64` | Per-day transfer limit (0 = use per-level default) |
| `daily_volume` | `u64` | Accumulated volume since last reset |
| `volume_reset_time` | `i64` | When daily volume was last reset |
| `verified_at` | `i64` | When KYC was last verified |
| `expiry_timestamp` | `i64` | When KYC expires (0 = never) |
| `last_activity` | `i64` | Last transfer timestamp |
| `created_at` | `i64` | Unix timestamp |
| `bump` | `u8` | PDA bump seed |

**PDA seeds:** `["whitelist", wallet]`

## Instructions

### `initialize_registry`

Create a KYC registry for a token mint. Sets `require_kyc` and `verified_only` to `true` by default.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | Yes | Yes | Registry admin (pays rent) |
| `mint` | No | No | Token-2022 mint |
| `registry` | No | Yes | KycRegistry PDA (initialized) |
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
| `daily_limit` | `u64` | Custom daily limit (0 = per-level default) |
| `expiry_timestamp` | `i64` | KYC expiry (0 = never) |

### `remove_from_whitelist`

Deactivate a wallet's whitelist entry (sets `is_active = false`). Does not close the account.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `authority` | Yes | No | Registry authority |
| `registry` | No | Yes | KycRegistry PDA |
| `whitelist_entry` | No | Yes | WhitelistEntry PDA |

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

Set up the Token-2022 extra account meta list for automatic transfer hook resolution. This must be called once per mint before the hook can process transfers.

The meta list resolves five additional accounts for each transfer:
1. **KycRegistry** — derived from mint
2. **Sender WhitelistEntry** — `["whitelist", owner]`, where owner is the wallet stored in the source token account (bytes 32..64)
3. **Recipient WhitelistEntry** — `["whitelist", owner]` of the destination token account
4. **Sender BlacklistEntry** — `["blacklist", owner]` of the source token account (may be an empty account)
5. **Recipient BlacklistEntry** — `["blacklist", owner]` of the destination token account (may be an empty account)

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `payer` | Yes | Yes | Pays rent for meta list account |
| `mint` | No | No | Token-2022 mint |
| `extra_account_meta_list` | No | Yes | Meta list PDA (initialized) |
| `system_program` | No | No | System program |

### `execute`

Main transfer hook entry point. Called automatically by Token-2022 on every transfer. Validates compliance and emits `TransferValidated` event.

**Validation order:**
1. Registry is active
2. Neither owner wallet has an active BlacklistEntry of this registry
3. Both WhitelistEntry accounts belong to this registry and to the token accounts' owner wallets
4. Sender is whitelisted and not expired
5. Sender jurisdiction is allowed
6. Sender daily volume limit not exceeded
7. Transfer amount within sender's per-level limit
8. Recipient is whitelisted and not expired
9. Recipient jurisdiction is allowed
10. Transfer amount within recipient's per-level limit

On success, the transfer amount is added to the sender WhitelistEntry's `daily_volume` (reset after 24h), so `daily_limit` is enforced across transfers.

**Accounts:**

| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| `source` | No | No | Source token account |
| `mint` | No | No | Token mint |
| `destination` | No | No | Destination token account |
| `owner` | No | No | Token owner |
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
| `InvalidWhitelistEntry` | Whitelist entry is malformed |
| `Overflow` | Arithmetic overflow in volume calculation |

## Trade Limits by KYC Level

| KYC Level | Per-Transaction Limit | Description |
|-----------|----------------------|-------------|
| Basic | 100,000 JPY (100,000,000,000 base units) | Email + phone |
| Standard | 10,000,000 JPY (10,000,000,000,000 base units) | Government ID |
| Enhanced | 100,000,000 JPY (100,000,000,000,000 base units) | Video call + address proof |
| Institutional | Unlimited (u64::MAX) | Corporate KYC/KYB |

Base units assume 6 decimal places.
