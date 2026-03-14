# Router Guide

## @fabrknt/accredit-router

Compliance-aware DEX routing that wraps Jupiter aggregation. Ensures every trade route passes through audited, whitelisted liquidity pools and that the trader meets KYC requirements.

### Installation

```json
{
  "dependencies": {
    "@fabrknt/accredit-router": "workspace:*"
  }
}
```

### ComplianceAwareRouter

The main entry point. Orchestrates KYC checks, Jupiter quotes, and route filtering.

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { ComplianceAwareRouter } from '@fabrknt/accredit-router';

const connection = new Connection('https://api.devnet.solana.com');
const registryAuthority = new PublicKey('...');  // Pool registry authority

const router = new ComplianceAwareRouter(connection, registryAuthority, {
  jupiterApiBaseUrl: 'https://quote-api.jup.ag/v6',
  defaultSlippageBps: 50,
  fallbackToDirectRoutes: true,
  maxRouteHops: 4,
});

// Sync the pool whitelist from on-chain state
const poolCount = await router.syncWhitelist();
console.log(`Loaded ${poolCount} whitelisted pools`);

// Get a compliant quote
const trader = new PublicKey('...');
const quote = await router.getCompliantQuote(
  trader,
  {
    inputMint: 'So11111111111111111111111111111111111111112',  // SOL
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    amount: '1000000000',  // 1 SOL in lamports
    slippageBps: 50,
  },
  0b00101111  // jurisdiction bitmask (Japan + SG + HK + EU + Other)
);

console.log('Output amount:', quote.quote.outAmount);
console.log('Was filtered:', quote.wasFiltered);
console.log('Compliant hops:', quote.compliantHopCount);
console.log('Trader KYC:', quote.traderKycLevel);
```

**Flow:**
1. Checks trader KYC via the transfer-hook whitelist
2. Fetches a Jupiter quote
3. Validates all route hops against the pool whitelist
4. If any hop is non-compliant, retries with `onlyDirectRoutes: true`
5. Returns a `CompliantQuoteResult` or throws

### Configuration

```typescript
interface ComplianceRouterConfig {
  rpcUrl?: string;                    // RPC connection URL
  registryProgramId?: PublicKey;      // Compliant registry program ID
  transferHookProgramId?: PublicKey;  // Transfer hook program ID
  jupiterApiBaseUrl?: string;         // Jupiter API URL (default: v6)
  defaultSlippageBps?: number;        // Default slippage (default: 50 = 0.5%)
  fallbackToDirectRoutes?: boolean;   // Retry with direct routes (default: true)
  maxRouteHops?: number;              // Max route hops (default: 4)
}
```

All fields are optional. Defaults use the Accredit program IDs and Jupiter v6 API.

### Checking Route Compliance

Check whether a Jupiter quote's route is compliant without performing KYC:

```typescript
const compliance = router.isRouteCompliant(jupiterQuote);

if (compliance.isCompliant) {
  console.log('All hops are whitelisted');
} else {
  console.log('Non-compliant pools:', compliance.nonCompliantPools);
  console.log('Compliant pools:', compliance.compliantPools);
}
```

### Internal Components

The router exposes its internal components for advanced usage:

```typescript
// Jupiter API client
const aggregator = router.getAggregator();
const quote = await aggregator.getQuote(request);
const swap = await aggregator.getSwapTransaction(params);

// Route optimization
const optimizer = router.getOptimizer();
const optimal = await optimizer.findOptimalRoute(inputMint, outputMint, amount, slippageBps);

// Pool whitelist management
const whitelist = router.getWhitelistManager();
await whitelist.syncFromChain();
const isWhitelisted = whitelist.isWhitelisted(ammKey);
const entry = whitelist.getEntry(ammKey);
const allKeys = whitelist.getWhitelistedKeys();

// KYC compliance checking
const kycChecker = router.getKycChecker();
const result = await kycChecker.checkTraderCompliance(trader, minKycLevel, bitmask);

// ZK proof generation (requires NoirProver)
const zkProver = router.getZkProver();
if (zkProver.isZkEnabled) {
  const proof = await zkProver.generateComplianceProof({ ... });
  const valid = await zkProver.verifyComplianceProof(proof);
}
```

### JupiterAggregator

Standalone Jupiter API client, usable without the full router:

```typescript
import { JupiterAggregator, RouteOptimizer } from '@fabrknt/accredit-router';

const aggregator = new JupiterAggregator({
  apiBaseUrl: 'https://quote-api.jup.ag/v6',
  defaultSlippageBps: 50,
});

// Get a quote
const quote = await aggregator.getQuote({
  inputMint: 'So11...',
  outputMint: 'EPjF...',
  amount: '1000000000',
});

// Get a swap transaction
const swap = await aggregator.getSwapTransaction({
  quoteResponse: quote,
  userPublicKey: wallet,
});

// Analyze best route
const route = await aggregator.getBestRoute({
  inputMint: 'So11...',
  outputMint: 'EPjF...',
  amount: '1000000000',
});

// Compare multiple amounts
const quotes = await aggregator.getQuotes(inputMint, outputMint, [
  '1000000000',
  '5000000000',
  '10000000000',
]);
```

### PoolWhitelistManager

Manages the local cache of whitelisted pools:

```typescript
import { PoolWhitelistManager } from '@fabrknt/accredit-router';

const whitelist = new PoolWhitelistManager(
  connection,
  registryProgramId,
  registryAuthority
);

// Sync from on-chain state
const count = await whitelist.syncFromChain();

// Check individual pools
whitelist.isWhitelisted(ammKey);  // boolean
whitelist.getEntry(ammKey);       // PoolComplianceEntry | undefined

// Manual management (for testing or local overrides)
whitelist.addPool(entry);
whitelist.removePool(ammKey);
```

### ZK Compliance Proofs

Optional zero-knowledge proof support for privacy-preserving compliance. Generates proofs that a trader meets KYC requirements without revealing their identity.

```typescript
import { ComplianceAwareRouter } from '@fabrknt/accredit-router';
import type { NoirProverLike } from '@fabrknt/accredit-router';

// Provide a NoirProver implementation
const noirProver: NoirProverLike = {
  async generateProof(circuitId, witness) {
    // Generate ZK proof using Noir
    return { proof: new Uint8Array(...), publicInputs: [...] };
  },
  async verifyProof(proof) {
    // Verify proof
    return true;
  },
};

const router = new ComplianceAwareRouter(
  connection,
  registryAuthority,
  {},
  noirProver  // optional fourth argument
);

const zkProver = router.getZkProver();
console.log('ZK enabled:', zkProver.isZkEnabled);  // true

// Generate a compliance proof
const proof = await zkProver.generateComplianceProof({
  kycLevel: KycLevel.Standard,
  jurisdiction: Jurisdiction.Japan,
  expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 365,
  minKycLevel: KycLevel.Basic,
  jurisdictionBitmask: 0b00101111,
  currentTimestamp: Math.floor(Date.now() / 1000),
  kycHash: new Uint8Array(32),
});

// Verify
const { valid } = await zkProver.verifyComplianceProof(proof);
```

### Error Handling

The router throws descriptive errors:

```typescript
try {
  const quote = await router.getCompliantQuote(trader, request);
} catch (err) {
  // "KYC check failed: No KYC record found"
  // "KYC check failed: KYC level 0 below minimum 1"
  // "KYC check failed: Jurisdiction 4 is not allowed"
  // "No compliant route found. Non-compliant pools: ammKey1, ammKey2"
}
```

### Type Exports

`@fabrknt/accredit-router` re-exports all types from `@fabrknt/accredit-core`:

```typescript
import type {
  CompliantQuoteResult,
  RouteComplianceResult,
  ComplianceRouterConfig,
  ZkComplianceProof,
  QuoteRequest,
  QuoteResponse,
  SwapParams,
  SwapResponse,
} from '@fabrknt/accredit-router';
```
