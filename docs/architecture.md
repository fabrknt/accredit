# Architecture

## Layered Design

Accredit separates concerns into four layers that consumers import independently:

```
┌─────────────────────────────────────────────────────────────┐
│  IDENTITY LAYER (KYC-as-a-Service + institutional UI)       │
│                                                             │
│  @accredit/kyc-providers                                    │
│    └─ Civic Pass, World ID, aggregation, bridge             │
│                                                             │
│  @accredit/institutional-ui                                 │
│    └─ React dashboard for compliance officers               │
├─────────────────────────────────────────────────────────────┤
│  WRAPPER LAYER (compliant asset wrapping)                   │
│                                                             │
│  compliant-wrapper program                                  │
│    └─ Wrap SPL tokens → Token-2022 with transfer hook       │
│    └─ 1:1 vault backing, KYC-gated wrap/unwrap              │
├─────────────────────────────────────────────────────────────┤
│  ROUTING LAYER (institutional DEX access)                   │
│                                                             │
│  compliant-registry program                                 │
│    └─ Pool whitelist, audit tracking, route verification    │
│                                                             │
│  @accredit/router                                           │
│    └─ ComplianceAwareRouter → Jupiter → route filtering     │
├─────────────────────────────────────────────────────────────┤
│  CORE LAYER (KYC/AML transfer enforcement)                  │
│                                                             │
│  transfer-hook program                                      │
│    └─ Token-2022 hook: whitelist check on every transfer    │
│                                                             │
│  accredit-types crate                                       │
│    └─ KycLevel, Jurisdiction, validation helpers            │
│                                                             │
│  @accredit/core + @accredit/sdk                             │
│    └─ TypeScript types, PDA derivation, KycClient           │
└─────────────────────────────────────────────────────────────┘
```

Consumer projects choose their layers:

- **Core only** — Basic KYC-gated token transfers. Import `accredit-types` (Rust) and `@accredit/core` + `@accredit/sdk` (TypeScript).
- **Core + Routing** — Full compliant DEX routing. Additionally import the `compliant-registry` program and `@accredit/router`.
- **Core + Wrapper** — KYC-gated asset wrapping. Additionally import the `compliant-wrapper` program.
- **Core + Identity** — Multi-provider KYC integration. Additionally import `@accredit/kyc-providers`.

## On-Chain Account Structure

### Transfer Hook Program

```
KycRegistry (per mint)
  PDA: ["kyc_registry", mint]
  ├── authority: Pubkey
  ├── mint: Pubkey
  ├── whitelist_count: u64
  ├── is_active: bool
  ├── require_kyc: bool
  ├── verified_only: bool
  ├── created_at: i64
  ├── updated_at: i64
  └── bump: u8

WhitelistEntry (per wallet)
  PDA: ["whitelist", wallet]
  ├── wallet: Pubkey
  ├── registry: Pubkey
  ├── kyc_level: KycLevel
  ├── jurisdiction: Jurisdiction
  ├── kyc_hash: [u8; 32]
  ├── is_active: bool
  ├── daily_limit: u64        (0 = use per-level default)
  ├── daily_volume: u64
  ├── volume_reset_time: i64
  ├── verified_at: i64
  ├── expiry_timestamp: i64   (0 = never expires)
  ├── last_activity: i64
  ├── created_at: i64
  └── bump: u8

ExtraAccountMetaList (per mint)
  PDA: ["extra-account-metas", mint]
  └── Resolves KycRegistry + sender/recipient WhitelistEntry for Token-2022
```

### Compliant Registry Program

```
CompliantPoolRegistry (per authority)
  PDA: ["pool_registry", authority]
  ├── authority: Pubkey
  ├── pool_count: u32
  ├── min_kyc_level: KycLevel
  ├── is_active: bool
  ├── created_at: i64
  ├── updated_at: i64
  └── bump: u8

PoolComplianceEntry (per pool)
  PDA: ["pool_entry", registry, amm_key]
  ├── amm_key: Pubkey           (Jupiter AMM key)
  ├── registry: Pubkey
  ├── operator: Pubkey
  ├── dex_label: String         (max 32 chars)
  ├── status: PoolStatus        (Active | Suspended | Revoked)
  ├── jurisdiction: Jurisdiction
  ├── kyc_level: KycLevel
  ├── audit_hash: [u8; 32]
  ├── audit_expiry: i64
  ├── registered_at: i64
  ├── updated_at: i64
  └── bump: u8

ComplianceConfig (per authority)
  PDA: ["compliance_config", authority]
  ├── authority: Pubkey
  ├── pool_registry: Pubkey
  ├── kyc_registry: Pubkey      (links to transfer-hook registry)
  ├── jurisdiction_bitmask: u8  (6 bits, one per jurisdiction)
  ├── basic_trade_limit: u64
  ├── standard_trade_limit: u64
  ├── enhanced_trade_limit: u64
  ├── zk_verifier_key: Pubkey   (Pubkey::default() = disabled)
  ├── is_active: bool
  ├── max_route_hops: u8
  ├── created_at: i64
  ├── updated_at: i64
  └── bump: u8
```

### Compliant Wrapper Program

```
WrapperConfig (per underlying mint + authority)
  PDA: ["wrapper_config", underlying_mint, authority]
  ├── authority: Pubkey
  ├── underlying_mint: Pubkey
  ├── wrapped_mint: Pubkey          (Token-2022 with transfer hook)
  ├── vault: Pubkey                 (holds underlying tokens 1:1)
  ├── kyc_registry: Pubkey
  ├── total_wrapped: u64
  ├── is_active: bool
  ├── min_kyc_level: u8
  ├── fee_bps: u16
  ├── fee_recipient: Pubkey
  ├── created_at: i64
  ├── updated_at: i64
  ├── bump: u8
  └── wrapped_mint_bump: u8
```

## PDA Derivation

All PDAs use deterministic seeds. The TypeScript SDK provides helper functions that mirror the on-chain derivation.

| Account | Seeds | Program |
|---------|-------|---------|
| KycRegistry | `["kyc_registry", mint]` | transfer-hook |
| WhitelistEntry | `["whitelist", wallet]` | transfer-hook |
| ExtraAccountMetaList | `["extra-account-metas", mint]` | transfer-hook |
| CompliantPoolRegistry | `["pool_registry", authority]` | compliant-registry |
| PoolComplianceEntry | `["pool_entry", registry, amm_key]` | compliant-registry |
| ComplianceConfig | `["compliance_config", authority]` | compliant-registry |
| WrapperConfig | `["wrapper_config", underlying_mint, authority]` | compliant-wrapper |
| Wrapped Mint | `["wrapped_mint", wrapper_config]` | compliant-wrapper |
| Wrapper Vault | `["wrapper_vault", wrapper_config]` | compliant-wrapper |

The whitelist PDA uses wallet as the sole seed (not registry + wallet). This means each wallet has exactly one global whitelist entry, simplifying lookups and enabling the transfer hook to resolve entries without knowing which registry the wallet belongs to.

## Transfer Flow

When a Token-2022 transfer occurs on a mint with the transfer hook enabled:

```
1. User initiates transfer
   │
2. Token-2022 resolves ExtraAccountMetaList
   │  → Derives KycRegistry PDA from mint
   │  → Derives sender WhitelistEntry PDA from source token account
   │  → Derives recipient WhitelistEntry PDA from destination token account
   │
3. Transfer hook `execute` runs
   │
   ├─ Registry active?            → RegistryInactive error
   ├─ Sender whitelisted + valid? → SenderNotWhitelisted error
   ├─ Sender jurisdiction OK?     → JurisdictionNotAllowed error
   ├─ Sender daily limit OK?      → DailyLimitExceeded error
   ├─ Sender per-level limit OK?  → TransferExceedsLimit error
   ├─ Recipient whitelisted?      → RecipientNotWhitelisted error
   ├─ Recipient jurisdiction OK?  → JurisdictionNotAllowed error
   └─ Recipient per-level limit?  → TransferExceedsLimit error
   │
4. Transfer completes, TransferValidated event emitted
```

## Compliant Routing Flow

The `ComplianceAwareRouter` orchestrates Jupiter quotes through compliance checks:

```
1. getCompliantQuote(trader, quoteRequest)
   │
2. Check trader KYC
   │  → KycComplianceChecker → KycClient.checkCompliance()
   │  → Verify: active, not expired, meets min level, jurisdiction allowed
   │
3. Get Jupiter quote
   │  → JupiterAggregator.getQuote(request)
   │
4. Filter route for compliance
   │  → RouteComplianceFilter.checkRouteCompliance(quote)
   │  → Check each routePlan step's ammKey against PoolWhitelistManager
   │
5a. All hops compliant → return CompliantQuoteResult
   │
5b. Non-compliant hops found
    │  → Retry with onlyDirectRoutes: true
    │  → If direct route is compliant → return it
    │  → Otherwise → throw "No compliant route found"
```

## Jurisdiction Bitmask

Jurisdictions are encoded as a 6-bit bitmask for efficient on-chain storage:

```
Bit 0 = Japan      (0b000001)
Bit 1 = Singapore  (0b000010)
Bit 2 = Hong Kong  (0b000100)
Bit 3 = EU         (0b001000)
Bit 4 = USA        (0b010000)
Bit 5 = Other      (0b100000)

Example: 0b00101111 (47) = Japan + Singapore + Hong Kong + EU + Other (no USA)
Example: 0b00111111 (63) = All jurisdictions
```

## Compliant Wrapping Flow

When a user wraps an existing token (e.g., USDC) into a compliant equivalent (cUSDC):

```
1. User calls `wrap(amount)` on compliant-wrapper
   │
2. Verify KYC
   │  → Read WhitelistEntry PDA from transfer-hook program
   │  → Check: is_active, kyc_level >= min_kyc_level, not expired
   │
3. Calculate fee
   │  → fee = amount * fee_bps / 10000
   │  → mint_amount = amount - fee
   │
4. Transfer underlying tokens
   │  → SPL transfer: user → vault
   │
5. Mint wrapped tokens
   │  → Token-2022 mint_to: wrapper_config PDA → user
   │
6. All subsequent transfers of wrapped token
   │  → Transfer hook `execute` fires automatically
   │  → Full KYC/AML validation on every transfer
```

## KYC Provider Integration Flow

When using external identity providers (Civic, Worldcoin) to populate the on-chain whitelist:

```
1. Provider verification
   │  → CivicProvider: read gateway token PDA on Solana
   │  → WorldcoinProvider: call Worldcoin verify API
   │
2. Aggregation (optional)
   │  → ProviderAggregator runs multiple providers
   │  → Apply strategy: any / all / majority / highest
   │
3. Bridge to whitelist
   │  → KycProviderBridge.buildWhitelistParams(result)
   │  → Generate SHA-256 kycHash from proof data
   │  → Map provider tier to KycLevel
   │
4. On-chain whitelist
   │  → Call add_to_whitelist with bridged params
   │  → User is now KYC-verified on-chain
```

## Package Dependency Graph

```
@accredit/institutional-ui
  ├── @accredit/core
  └── @solana/wallet-adapter-*

@accredit/kyc-providers
  ├── @accredit/core
  └── @solana/web3.js

@accredit/router
  ├── @accredit/sdk
  │   └── @accredit/core
  └── @accredit/core

compliant-wrapper (Rust)
  └── accredit-types

compliant-registry (Rust)
  └── accredit-types

transfer-hook (Rust)
  └── accredit-types
```
