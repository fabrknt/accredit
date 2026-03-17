# Accredit

[![npm version](https://img.shields.io/npm/v/@fabrknt/accredit-core.svg)](https://www.npmjs.com/package/@fabrknt/accredit-core)
[![npm downloads](https://img.shields.io/npm/dm/@fabrknt/accredit-core.svg)](https://www.npmjs.com/package/@fabrknt/accredit-core)

Chain-agnostic KYC/AML compliance infrastructure. On-chain transfer enforcement, compliant DEX routing, asset wrapping, and multi-provider KYC integration as reusable building blocks for regulated token applications.

Part of [Fabrknt](https://fabrknt.com) — plug-in compliance for existing DeFi protocols. `npm install @fabrknt/accredit-core`

## Overview

Accredit is organized into four layers:

**Core Layer** — Chain-agnostic compliance types and logic. KYC levels, jurisdiction checks, trade limits, and whitelist/blacklist management work across any chain. The Solana implementation uses Token-2022 transfer hooks for on-chain enforcement.

**Routing Layer** — Compliance-aware DEX aggregation. Routes are filtered to only pass through audited, whitelisted liquidity pools. Currently integrates Jupiter (Solana) with the architecture ready for EVM aggregator support. Includes optional zero-knowledge proof support for privacy-preserving compliance.

**Wrapper Layer** — Compliant asset wrapping. Wraps existing tokens (e.g., USDC, SOL) into KYC-gated Token-2022 equivalents (cUSDC, cSOL) with 1:1 backing. Wrapped tokens automatically inherit transfer hook enforcement, pulling existing liquidity into the compliance layer.

**Identity Layer** — Multi-provider KYC integration and institutional tooling. Pluggable KYC providers (Civic Pass, World ID) with aggregation strategies, bridging provider verification to on-chain whitelist entries. An institutional dashboard provides compliance officers with KYC management, pool registry oversight, wrapper operations, and analytics.

```
                        ┌───────────────────────────────┐
                        │           Accredit             │
                        │                                │
                        │  Core (chain-agnostic):        │
                        │   @fabrknt/accredit-core               │
                        │   accredit-types crate         │
                        │                                │
                        │  Solana:                       │
                        │   transfer-hook program        │
                        │   compliant-registry program   │
                        │   compliant-wrapper program    │
                        │   sovereign program            │
                        │   @fabrknt/accredit-sdk                │
                        │                                │
                        │  Routing:                      │
                        │   @fabrknt/accredit-router             │
                        │                                │
                        │  Identity:                     │
                        │   @fabrknt/accredit-kyc-providers      │
                        │   @fabrknt/accredit-institutional-ui   │
                        └───────────────┬───────────────-┘
                                        │
                       ┌────────────────┴───────────────┐
                       │                                │
                  core + routing                   core only
                       │                                │
              ┌────────▼────────┐            ┌──────────▼────────┐
              │    Meridian     │            │    Continuum      │
              │  (securities)   │            │  (repo treasury)  │
              └─────────────────┘            └───────────────────┘
```

## Repository Structure

```
accredit/
├── crates/
│   └── accredit-types/         # Shared Rust types (KycLevel, Jurisdiction, helpers)
├── programs/
│   ├── transfer-hook/          # Token-2022 transfer hook — KYC enforcement (Solana)
│   ├── compliant-registry/     # Pool compliance registry — route verification (Solana)
│   ├── compliant-wrapper/      # Asset wrapper — KYC-gated token wrapping (Solana)
│   └── sovereign/              # Universal identity & multi-dimensional reputation (Solana)
├── packages/
│   ├── core/                   # @fabrknt/accredit-core — Chain-agnostic TypeScript types
│   ├── sdk/                    # @fabrknt/accredit-sdk — Solana PDA derivation + clients
│   ├── router/                 # @fabrknt/accredit-router — Compliance-aware DEX routing
│   ├── kyc-providers/          # @fabrknt/accredit-kyc-providers — Multi-provider KYC integration
│   ├── sovereign-sdk/          # Sovereign identity SDK
│   ├── qn-addon/               # Fabrknt On-Chain Compliance — QuickNode add-on
│   └── institutional-ui/       # Institutional compliance dashboard (React)
└── tests/                      # Integration tests (ts-mocha)
```

## Chain-Agnostic Types

`@fabrknt/accredit-core` has zero chain-specific dependencies. All address fields use `string` (not `PublicKey`), making types consumable from any chain context:

```typescript
import { KycLevel, Jurisdiction, isJurisdictionAllowed } from "@fabrknt/accredit-core";
import type { WhitelistEntry, ComplianceCheckResult, Chain } from "@fabrknt/accredit-core";

// Chain type: "solana" | "evm"
// All addresses are plain strings — Solana base58 or EVM hex
```

Chain-specific SDKs (`@fabrknt/accredit-sdk` for Solana) convert between on-chain types and the chain-agnostic interfaces at the deserialization boundary.

## Programs

### Transfer Hook (`5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL`)

Token-2022 transfer hook that validates every token transfer against KYC/AML requirements:

- Wallet whitelist with KYC level, jurisdiction, and expiry
- Per-wallet daily volume tracking and limits
- Per-KYC-level transaction size limits
- Jurisdiction restrictions (USA blocked by default)
- Emergency pause/resume for the registry
- Authority transfer

See [docs/programs/transfer-hook.md](docs/programs/transfer-hook.md) for full reference.

### Compliant Registry (`66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA`)

On-chain registry of audited DEX pools for compliant route verification:

- Pool registration with audit hash, jurisdiction, and KYC requirements
- Pool lifecycle management (Active / Suspended / Revoked)
- Batch route verification (validate all hops in a single instruction)
- Compliance config linking pool registry to KYC registry

See [docs/programs/compliant-registry.md](docs/programs/compliant-registry.md) for full reference.

### Compliant Wrapper (`CWRPxn8XsLkWW5fN5RYkWRQr5o4bT1RaAi3AhAPDnj1L`)

Wraps existing SPL tokens into KYC-gated Token-2022 equivalents:

- 1:1 backed wrapping (deposit USDC, receive cUSDC)
- Wrapped mint uses Token-2022 with transfer hook extension for automatic compliance
- KYC verification required for wrap/unwrap (reads WhitelistEntry from transfer-hook program)
- Configurable fee (basis points) and minimum KYC level
- Emergency pause/resume for the wrapper
- Per-wrapper vault holding underlying assets

See [docs/programs/compliant-wrapper.md](docs/programs/compliant-wrapper.md) for full reference.

### Sovereign (Identity & Reputation)

Universal identity and multi-dimensional reputation protocol:

- **5 reputation dimensions** — Trading, Civic, Developer, Infra, Creator
- **Tiered progression** — Bronze, Silver, Gold, Platinum, Diamond
- **Creator DAO extension** — Governance for creator-led communities
- **Admission Market extension** — Marketplace for identity and access credentials
- On-chain identity aggregation linked to KYC and compliance state

See [docs/programs/sovereign.md](docs/programs/sovereign.md) for full reference.

## TypeScript Packages

| Package | Description | Chain |
|---------|-------------|-------|
| `@fabrknt/accredit-core` | Shared type definitions (enums, interfaces, constants) | Agnostic |
| `@fabrknt/accredit-sdk` | PDA derivation, `KycClient`, `RegistryClient`, `WrapperClient` | Solana |
| `@fabrknt/accredit-router` | `ComplianceAwareRouter`, Jupiter integration, ZK proofs | Solana |
| `@fabrknt/accredit-kyc-providers` | Multi-provider KYC integration (Civic, Worldcoin) | Agnostic |
| `sovereign-sdk` | Sovereign identity SDK | Solana |
| `fabrknt-onchain-compliance` | Fabrknt On-Chain Compliance — QuickNode add-on | Solana |
| `@fabrknt/accredit-institutional-ui` | Institutional compliance dashboard | Solana |

### KYC Providers

The `@fabrknt/accredit-kyc-providers` package integrates external identity providers to lower user friction:

- **Civic Pass** — Reads on-chain gateway tokens for liveness, ID verification, and uniqueness checks
- **World ID** — Verifies zero-knowledge proof-of-personhood via the Worldcoin API
- **Provider Aggregator** — Multi-provider consensus with strategies: `any`, `all`, `majority`, `highest`
- **KYC Bridge** — Converts provider verification results into on-chain whitelist parameters

See [docs/sdk/kyc-providers.md](docs/sdk/kyc-providers.md) for usage guide.

### Institutional Dashboard

The `@fabrknt/accredit-institutional-ui` package provides a React-based compliance dashboard for institutional users:

- KYC management (whitelist entries, batch operations, provider verification)
- Pool registry oversight (compliant pools, status tracking)
- Wrapper operations (supply monitoring, wrap/unwrap)
- Compliance analytics (jurisdiction distribution, KYC level breakdown, audit trail)

See [docs/sdk/institutional-ui.md](docs/sdk/institutional-ui.md) for setup instructions.

### QuickNode Add-on: Fabrknt On-Chain Compliance

The `qn-addon` package (`fabrknt-onchain-compliance`) exposes compliance and identity data via QuickNode Marketplace:

- KYC whitelist reads and provider-based verification
- Compliance checks
- Identity reads
- Trust assessment
- Route compliance
- ZK proof inputs
- Wrapper config and supply reads

**Plans:**

| Plan | Price | Endpoints |
|------|-------|-----------|
| Starter | Free | Route compliance, trust assessment, ZK proof inputs |
| Pro | $49/mo | All Starter endpoints + on-chain KYC and identity reads |

See [docs/sdk/](docs/sdk/) for usage guides.

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) (1.79+)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (2.2.1+)
- [Anchor](https://www.anchor-lang.com/docs/installation) (0.32.1)
- [Node.js](https://nodejs.org/) (20+)
- [pnpm](https://pnpm.io/) (10.31.0+)

### Build

```bash
# Install TypeScript dependencies
pnpm install

# Build Anchor programs
anchor build

# Build TypeScript packages
pnpm build
```

### Test

```bash
# Run on-chain + SDK tests (requires solana-test-validator)
anchor test

# Run TypeScript package tests
pnpm test
```

### Using as a Dependency

**Rust crate** (in your program's `Cargo.toml`):
```toml
[dependencies]
accredit-types = { path = "../accredit/crates/accredit-types" }
```

**TypeScript packages** (add accredit to your pnpm workspace):
```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "../accredit/packages/*"
```

Then in your `package.json`:
```json
{
  "dependencies": {
    "@fabrknt/accredit-core": "workspace:*",
    "@fabrknt/accredit-sdk": "workspace:*",
    "@fabrknt/accredit-router": "workspace:*"
  }
}
```

See [docs/integration.md](docs/integration.md) for detailed integration instructions.

## KYC Levels

| Level | Description | Per-Transaction Limit |
|-------|-------------|----------------------|
| Basic | Email + phone verification | 100,000 JPY |
| Standard | Government ID document | 10,000,000 JPY |
| Enhanced | Video call + address proof | 100,000,000 JPY |
| Institutional | Corporate KYC/KYB | Unlimited |

## Jurisdictions

| Jurisdiction | Code | Transfer Status |
|-------------|------|-----------------|
| Japan | 0 | Allowed (primary market) |
| Singapore | 1 | Allowed |
| Hong Kong | 2 | Allowed |
| EU | 3 | Allowed |
| USA | 4 | Restricted |
| Other | 5 | Allowed |

## Documentation

- [Architecture](docs/architecture.md) — System design, account structures, PDA derivation
- [Transfer Hook Program](docs/programs/transfer-hook.md) — Instruction reference and account contexts
- [Compliant Registry Program](docs/programs/compliant-registry.md) — Pool management and route verification
- [Compliant Wrapper Program](docs/programs/compliant-wrapper.md) — Asset wrapping and KYC-gated minting
- [SDK Guide](docs/sdk/getting-started.md) — `@fabrknt/accredit-core` and `@fabrknt/accredit-sdk` usage
- [Router Guide](docs/sdk/router.md) — `@fabrknt/accredit-router` compliance-aware routing
- [KYC Providers Guide](docs/sdk/kyc-providers.md) — Multi-provider KYC integration
- [Institutional Dashboard](docs/sdk/institutional-ui.md) — Dashboard setup and usage
- [Integration Guide](docs/integration.md) — Adding Accredit to your project

## Toolchain

| Tool | Version |
|------|---------|
| Anchor | 0.32.1 |
| Solana | 2.2.1 |
| Rust | 2021 edition |
| TypeScript | 5.6+ |
| Node.js | 20+ |

## License

MIT
