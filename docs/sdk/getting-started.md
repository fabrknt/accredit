# SDK Guide

## @accredit/types

Shared TypeScript type definitions that mirror the on-chain account structures. This package has no dependencies beyond `@solana/web3.js`.

### Installation

```json
{
  "dependencies": {
    "@accredit/types": "workspace:*"
  }
}
```

### Enums

```typescript
import { KycLevel, Jurisdiction, PoolStatus } from '@accredit/types';

// KYC verification levels
KycLevel.Basic          // 0
KycLevel.Standard       // 1
KycLevel.Enhanced       // 2
KycLevel.Institutional  // 3

// Jurisdictions
Jurisdiction.Japan      // 0
Jurisdiction.Singapore  // 1
Jurisdiction.HongKong   // 2
Jurisdiction.Eu         // 3
Jurisdiction.Usa        // 4 (restricted)
Jurisdiction.Other      // 5

// Pool compliance status
PoolStatus.Active       // 0
PoolStatus.Suspended    // 1
PoolStatus.Revoked      // 2
```

### Interfaces

```typescript
import type {
  WhitelistEntry,
  KycRegistry,
  PoolComplianceEntry,
  ComplianceConfig,
} from '@accredit/types';
```

These interfaces match the on-chain account layouts. See [architecture.md](../architecture.md) for field definitions.

### Helper Functions

```typescript
import {
  KYC_TRADE_LIMITS,
  isJurisdictionInBitmask,
  isJurisdictionAllowed,
} from '@accredit/types';

// Per-level trade limits (bigint, 6 decimal base units)
KYC_TRADE_LIMITS[KycLevel.Basic];          // 100_000_000_000n (100K JPY)
KYC_TRADE_LIMITS[KycLevel.Standard];       // 10_000_000_000_000n (10M JPY)
KYC_TRADE_LIMITS[KycLevel.Enhanced];       // 100_000_000_000_000n (100M JPY)
KYC_TRADE_LIMITS[KycLevel.Institutional];  // u64::MAX

// Check if jurisdiction is in a bitmask
const bitmask = 0b00101111; // Japan + Singapore + HongKong + EU + Other
isJurisdictionInBitmask(Jurisdiction.Japan, bitmask);  // true
isJurisdictionInBitmask(Jurisdiction.Usa, bitmask);    // false

// Check if jurisdiction is generally allowed (USA is restricted)
isJurisdictionAllowed(Jurisdiction.Japan);  // true
isJurisdictionAllowed(Jurisdiction.Usa);    // false
```

---

## @accredit/sdk

Core SDK for interacting with on-chain Accredit accounts. Provides PDA derivation, account deserialization, and compliance checking.

### Installation

```json
{
  "dependencies": {
    "@accredit/sdk": "workspace:*"
  }
}
```

### PDA Derivation

```typescript
import {
  findKycRegistryPda,
  findWhitelistEntryPda,
  findExtraAccountMetaListPda,
  findPoolRegistryPda,
  findPoolEntryPda,
  findComplianceConfigPda,
  findWrapperConfigPda,
  findWrappedMintPda,
  findWrapperVaultPda,
} from '@accredit/sdk';
import { PublicKey } from '@solana/web3.js';

const TRANSFER_HOOK_PROGRAM = new PublicKey('5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL');
const REGISTRY_PROGRAM = new PublicKey('66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA');
const WRAPPER_PROGRAM = new PublicKey('CWRPxn8XsLkWW5fN5RYkWRQr5o4bT1RaAi3AhAPDnj1L');

// Core layer PDAs
const [registryPda, registryBump] = findKycRegistryPda(mint, TRANSFER_HOOK_PROGRAM);
const [entryPda, entryBump] = findWhitelistEntryPda(wallet, TRANSFER_HOOK_PROGRAM);
const [metasPda, metasBump] = findExtraAccountMetaListPda(mint, TRANSFER_HOOK_PROGRAM);

// Routing layer PDAs
const [poolRegPda] = findPoolRegistryPda(authority, REGISTRY_PROGRAM);
const [poolEntryPda] = findPoolEntryPda(poolRegPda, ammKey, REGISTRY_PROGRAM);
const [configPda] = findComplianceConfigPda(authority, REGISTRY_PROGRAM);

// Wrapper layer PDAs
const [wrapperConfigPda] = findWrapperConfigPda(underlyingMint, authority, WRAPPER_PROGRAM);
const [wrappedMintPda] = findWrappedMintPda(wrapperConfigPda, WRAPPER_PROGRAM);
const [vaultPda] = findWrapperVaultPda(wrapperConfigPda, WRAPPER_PROGRAM);
```

### KycClient

Reads and deserializes transfer-hook accounts. Provides caching and compliance checks.

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { KycClient, KycLevel } from '@accredit/sdk';

const connection = new Connection('https://api.devnet.solana.com');
const programId = new PublicKey('4CoN4C1mqdkgvgQeXMSa1Pnb7guFH89DekEvRHgKmivf');

const client = new KycClient(connection, programId);

// Fetch a KYC registry
const registry = await client.getRegistry(mint);
if (registry) {
  console.log('Active:', registry.isActive);
  console.log('Wallets:', registry.whitelistCount.toString());
}

// Fetch a whitelist entry (results are cached)
const entry = await client.getWhitelistEntry(wallet);
if (entry) {
  console.log('KYC Level:', entry.kycLevel);
  console.log('Jurisdiction:', entry.jurisdiction);
  console.log('Expires:', entry.expiryTimestamp.toString());
}

// Full compliance check
const result = await client.checkCompliance(
  wallet,
  KycLevel.Standard,    // minimum required level
  0b00101111            // allowed jurisdictions bitmask
);

if (result.isCompliant) {
  console.log('Wallet is compliant');
} else {
  console.log('Not compliant:', result.reason);
  // Possible reasons:
  // - "No KYC record found"
  // - "KYC record is inactive"
  // - "KYC verification has expired"
  // - "KYC level 0 below minimum 1"
  // - "Jurisdiction 4 is not allowed"
}

// Clear cache when needed
client.clearCache();          // clear all
client.clearCache(wallet);    // clear specific wallet
```

### RegistryClient

Reads compliant-registry accounts.

```typescript
import { RegistryClient, PoolStatus } from '@accredit/sdk';

const registryClient = new RegistryClient(connection, registryProgramId);

// Fetch all active pool entries for a registry authority
const pools = await registryClient.getActivePoolEntries(authority);
for (const pool of pools) {
  console.log(pool.ammKey.toBase58(), pool.dexLabel, PoolStatus[pool.status]);
}

// Fetch a specific pool entry
const pool = await registryClient.getPoolEntry(registryPda, ammKey);
if (pool && pool.status === PoolStatus.Active) {
  console.log('Pool is compliant');
}
```

### WrapperClient

Reads compliant-wrapper accounts.

```typescript
import { WrapperClient } from '@accredit/sdk';

const wrapperClient = new WrapperClient(
  connection,
  new PublicKey('CWRPxn8XsLkWW5fN5RYkWRQr5o4bT1RaAi3AhAPDnj1L')
);

// Get wrapper config for a specific underlying mint + authority
const config = await wrapperClient.getWrapperConfig(usdcMint, authority);
if (config) {
  console.log('Wrapped mint:', config.wrappedMint);
  console.log('Total wrapped:', config.totalWrapped.toString());
  console.log('Active:', config.isActive);
  console.log('Min KYC:', config.minKycLevel);
  console.log('Fee:', config.feeBps, 'bps');
}

// Get wrapper config by PDA address
const configByAddr = await wrapperClient.getWrapperConfigByAddress(wrapperConfigPda);

// List all wrapper configs
const allConfigs = await wrapperClient.getAllWrapperConfigs();
for (const cfg of allConfigs) {
  console.log(cfg.underlyingMint, '→', cfg.wrappedMint);
}
```

### Re-exports

`@accredit/sdk` re-exports common types for convenience:

```typescript
import {
  KycLevel,
  Jurisdiction,
  PoolStatus,
} from '@accredit/sdk';

import type {
  WhitelistEntry,
  KycRegistry,
  PoolComplianceEntry,
  WrapperConfig,
} from '@accredit/sdk';
```
