# @fabrknt/accredit-core

[![npm version](https://img.shields.io/npm/v/@fabrknt/accredit-core.svg)](https://www.npmjs.com/package/@fabrknt/accredit-core)
[![npm downloads](https://img.shields.io/npm/dm/@fabrknt/accredit-core.svg)](https://www.npmjs.com/package/@fabrknt/accredit-core)

Chain-agnostic KYC/AML compliance types and logic. Zero chain-specific dependencies.

Not every DeFi protocol needs TradFi compliance -- but if yours does, you shouldn't have to rebuild from scratch. Fabrknt plugs into your existing protocol with composable SDKs and APIs. No permissioned forks, no separate deployments.

## Install

```bash
npm install @fabrknt/accredit-core
```

## Quick Start

```typescript
import {
  KycLevel,
  Jurisdiction,
  isJurisdictionAllowed,
  KYC_TRADE_LIMITS,
} from "@fabrknt/accredit-core";
import type { WhitelistEntry, ComplianceCheckResult } from "@fabrknt/accredit-core";

// Check if a jurisdiction is allowed in a bitmask
const allowed = isJurisdictionAllowed(Jurisdiction.Japan, bitmask);

// Look up per-level trade limits
const limit = KYC_TRADE_LIMITS[KycLevel.Standard]; // 10,000,000

// All address fields are plain strings (base58 or hex) -- no PublicKey dependency
const entry: WhitelistEntry = {
  address: "So11111111111111111111111111111112",
  kycLevel: KycLevel.Enhanced,
  jurisdiction: Jurisdiction.Singapore,
  expiresAt: Date.now() + 86400_000,
};
```

## Features

- Chain-agnostic types -- all addresses are `string`, not `PublicKey` or `Address`
- KYC level definitions (Basic, Standard, Enhanced, Institutional) with trade limits
- Jurisdiction model with bitmask-based allow/block logic
- Whitelist/blacklist entry types for on-chain enforcement
- Pool compliance and route verification types for DEX routing
- Compliant asset wrapper types (wrap/unwrap requests and config)
- Zero-knowledge compliance proof type definitions
- String conversion helpers for KYC levels and jurisdictions

## API

### Enums

- `KycLevel` -- Basic, Standard, Enhanced, Institutional
- `Jurisdiction` -- Japan, Singapore, HongKong, EU, USA, Other
- `PoolStatus` -- Active, Suspended, Revoked

### Functions

- `isJurisdictionAllowed(jurisdiction, bitmask)` -- check jurisdiction against a bitmask
- `isJurisdictionInBitmask(jurisdiction, bitmask)` -- test bitmask membership
- `kycLevelToString(level)` / `kycLevelFromString(str)` -- enum-string conversion
- `jurisdictionToString(j)` / `jurisdictionFromString(str)` -- enum-string conversion

### Constants

- `KYC_TRADE_LIMITS` -- per-level transaction size limits

### Types

- `WhitelistEntry`, `BlacklistEntry`, `KycRegistry` -- identity registry
- `ComplianceCheckResult` -- transfer validation result
- `Chain` -- `"solana" | "evm"`
- `PoolComplianceEntry`, `RouteComplianceResult`, `ComplianceRouterConfig` -- DEX routing
- `CompliantQuoteResult`, `QuoteRequest`, `QuoteResponse` -- quote types
- `SwapRoute`, `SwapParams`, `SwapResponse` -- swap execution types
- `ZkComplianceProof` -- zero-knowledge proof structure
- `WrapperConfig`, `WrapRequest`, `UnwrapRequest`, `WrapResult` -- asset wrapping

## Documentation

See the [Accredit repository README](https://github.com/fabrknt/accredit#readme) for full documentation, including Solana program references, SDK guides, router integration, and KYC provider setup.

## Related Packages

| Package | Description |
|---------|-------------|
| `@fabrknt/accredit-sdk` | Solana PDA derivation, KycClient, RegistryClient, WrapperClient |
| `@fabrknt/accredit-router` | Compliance-aware DEX routing with Jupiter integration |
| `@fabrknt/accredit-kyc-providers` | Multi-provider KYC integration (Civic, World ID) |

## License

MIT
