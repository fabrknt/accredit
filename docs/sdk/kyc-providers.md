# KYC Providers Guide

## @fabrknt/accredit-kyc-providers

Multi-provider KYC integration that bridges external identity providers (Civic Pass, World ID) to Accredit's on-chain whitelist. Rather than performing KYC in-house, this package lets you plug into established identity networks and convert their verification results into on-chain whitelist entries.

### Installation

```json
{
  "dependencies": {
    "@fabrknt/accredit-kyc-providers": "workspace:*"
  }
}
```

### KycProvider Interface

All providers implement a common interface:

```typescript
import type { KycProvider, ProviderVerificationResult } from '@fabrknt/accredit-kyc-providers';

interface KycProvider {
  readonly name: string;
  checkVerification(wallet: string): Promise<ProviderVerificationResult | null>;
  initiateVerification(wallet: string, opts?: VerificationOptions): Promise<VerificationSession>;
  validateProof(proofData: Uint8Array): Promise<boolean>;
  mapToKycLevel(providerTier: unknown): KycLevel;
}
```

A `ProviderVerificationResult` contains:

```typescript
interface ProviderVerificationResult {
  verified: boolean;
  provider: string;           // e.g., "civic", "worldcoin"
  kycLevel: KycLevel;         // mapped from provider tier
  jurisdiction: Jurisdiction;  // from provider data
  providerUserId: string;     // provider-specific ID
  proofData: Uint8Array;      // on-chain verifiable proof
  expiresAt: number;          // unix timestamp
  metadata?: Record<string, unknown>;
}
```

---

## Civic Pass

Reads Civic Pass gateway tokens directly from Solana. No dependency on `@civic/solana-gateway-ts` — gateway token PDAs and account data are parsed manually.

### Setup

```typescript
import { Connection } from '@solana/web3.js';
import { CivicProvider } from '@fabrknt/accredit-kyc-providers';

const connection = new Connection('https://api.devnet.solana.com');

// Use a known Civic gatekeeper network
const civic = new CivicProvider(
  connection,
  'tigoYhp9SpCDoCQmXGj2im5xa3mnjR1zuXrpCJ5ZRmi'  // ID verification network
);
```

### Check Verification

```typescript
const result = await civic.checkVerification(walletAddress);

if (result) {
  console.log('Verified:', result.verified);
  console.log('KYC Level:', result.kycLevel);     // KycLevel.Standard for idVerification
  console.log('Expires:', result.expiresAt);
  console.log('Pass type:', result.metadata?.passType);
} else {
  console.log('No active Civic Pass found');
}
```

### KYC Level Mapping

| Civic Pass Type | KycLevel |
|----------------|----------|
| `liveness` | Basic |
| `idVerification` | Standard |
| `uniqueness` | Enhanced |

### Initiate Verification

```typescript
const session = await civic.initiateVerification(walletAddress);
// session.verificationUrl -> redirect user to complete Civic Pass flow
// session.status -> 'pending'
```

### Gateway Token PDA

Gateway tokens are derived with seeds:

```
["gateway_token", wallet_pubkey, gatekeeper_network_pubkey, seed_offset(8 bytes, 0)]
```

Under the Civic Gateway program: `gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs`

---

## World ID (Worldcoin)

Verifies proof-of-personhood via the Worldcoin Developer Portal API. World ID proves a user is a unique human without revealing identity documents, so it maps to `KycLevel.Basic`.

### Setup

```typescript
import { WorldcoinProvider } from '@fabrknt/accredit-kyc-providers';

const worldcoin = new WorldcoinProvider(
  'app_your_app_id',
  'your_action_id',
  'https://developer.worldcoin.org'  // optional, this is the default
);
```

### Check Verification

```typescript
const result = await worldcoin.checkVerification(walletAddress);

if (result) {
  console.log('Verified:', result.verified);
  console.log('KYC Level:', result.kycLevel);       // Always KycLevel.Basic
  console.log('Jurisdiction:', result.jurisdiction); // Always Jurisdiction.Other
}
```

### Limitations

- World ID only proves personhood, not identity documents — always maps to `KycLevel.Basic`
- Jurisdiction cannot be determined from World ID — defaults to `Jurisdiction.Other`
- Proof verification is API-based (not on-chain on Solana)

---

## Provider Aggregator

Runs multiple providers in parallel and applies a consensus strategy.

```typescript
import { ProviderAggregator } from '@fabrknt/accredit-kyc-providers';

const aggregator = new ProviderAggregator();

const result = await aggregator.verify(walletAddress, {
  providers: [civic, worldcoin],
  strategy: 'highest',
});

if (result.verified) {
  console.log('Best KYC level:', result.kycLevel);
  console.log('Provider results:', result.results.length);
}
```

### Strategies

| Strategy | Behavior |
|----------|----------|
| `any` | Verified if any provider returns verified |
| `all` | Verified only if all providers return verified |
| `majority` | Verified if >50% of providers verify (configurable via `minProviders`) |
| `highest` | Returns the result with the highest KycLevel among verified providers |

---

## KYC Provider Bridge

Converts provider verification results into parameters for the on-chain `add_to_whitelist` instruction. Does not submit transactions — the caller uses the returned params with the SDK.

```typescript
import { KycProviderBridge } from '@fabrknt/accredit-kyc-providers';

const bridge = new KycProviderBridge(
  connection,
  '5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL',  // transfer-hook program
  authorityKeypair
);

// Get provider verification
const result = await civic.checkVerification(walletAddress);

if (result) {
  // Build whitelist params
  const params = bridge.buildWhitelistParams(result);

  console.log('Wallet:', params.wallet.toBase58());
  console.log('KYC Level:', params.kycLevel);
  console.log('Jurisdiction:', params.jurisdiction);
  console.log('KYC Hash:', Buffer.from(params.kycHash).toString('hex'));
  console.log('Expiry:', params.expiryTimestamp);

  // Use params with the SDK to call add_to_whitelist instruction
}
```

### KYC Hash Generation

The bridge generates a deterministic 32-byte SHA-256 hash from:

```
SHA-256(provider_name + provider_user_id + proof_data)
```

This hash is stored on-chain in the WhitelistEntry's `kyc_hash` field, providing a verifiable link between the provider verification and the on-chain record.

---

## QN Add-on Endpoints

The QuickNode add-on exposes provider integration via REST:

```
GET  /v1/kyc/providers                      — List configured providers
POST /v1/kyc/verify/:provider/:wallet       — Check verification from a provider
POST /v1/kyc/verify/aggregate               — Multi-provider aggregate check
```

### Aggregate Check

```bash
POST /v1/kyc/verify/aggregate
{
  "wallet": "...",
  "strategy": "highest",
  "providers": ["civic", "worldcoin"]
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CIVIC_GATEKEEPER_NETWORK` | Civic gatekeeper network public key |
| `WORLDCOIN_APP_ID` | Worldcoin Developer Portal app ID |
| `WORLDCOIN_ACTION_ID` | Worldcoin action ID |
| `WORLDCOIN_API_URL` | Worldcoin API URL (optional) |

---

## Type Exports

```typescript
import type {
  KycProvider,
  ProviderVerificationResult,
  VerificationSession,
  VerificationOptions,
  AggregationStrategy,
  ProviderAggregatorConfig,
  AggregateVerificationResult,
  WhitelistParams,
} from '@fabrknt/accredit-kyc-providers';

import {
  CivicProvider,
  WorldcoinProvider,
  ProviderAggregator,
  KycProviderBridge,
} from '@fabrknt/accredit-kyc-providers';
```
