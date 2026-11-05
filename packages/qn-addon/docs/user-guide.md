# Accredit -- QuickNode Marketplace Add-on

User guide for the **Fabrknt On-Chain Compliance** add-on (Accredit), available on the QuickNode Marketplace.

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication](#authentication)
4. [API Reference](#api-reference)
   - [KYC Endpoints (Pro)](#kyc-endpoints-pro)
   - [Identity Endpoints (Pro)](#identity-endpoints-pro)
   - [Trust Endpoints (Starter)](#trust-endpoints-starter)
   - [Route Compliance Endpoints (Starter)](#route-compliance-endpoints-starter)
   - [ZK Endpoints (Starter)](#zk-endpoints-starter)
5. [Error Handling](#error-handling)
6. [Use Cases](#use-cases)

---

## Overview

Accredit provides on-chain compliance infrastructure for Solana. It sits between your application and the Solana blockchain, giving you a simple REST API for:

- **KYC enforcement** -- Read whitelist entries and run compliance checks against on-chain KYC data. Verify that wallets meet minimum KYC levels and jurisdiction requirements before allowing transactions.
- **Identity reputation** -- Read SOVEREIGN identity scores across five dimensions (trading, civic, developer, infra, creator) to understand a wallet's on-chain reputation profile.
- **Trust assessment** -- Stateless trust evaluation from SOVEREIGN scores. Compare wallets, check thresholds, and analyze score profiles without any on-chain reads.
- **Route compliance** -- Validate that swap route plans only pass through whitelisted liquidity pools. Manage a pool whitelist to enforce which AMMs your users can interact with.
- **ZK proof inputs** -- Generate witness inputs for Noir ZK compliance circuits and verify constraint satisfaction before proof generation. Enables privacy-preserving compliance proofs.

Supported chains: **Solana** (mainnet-beta, devnet).

---

## Getting Started

### Installation

1. Go to the [QuickNode Marketplace](https://marketplace.quicknode.com).
2. Search for **Fabrknt On-Chain Compliance**.
3. Click **Add** and select your existing Solana endpoint (or create a new one).
4. Choose a plan.

### Plans

| Plan | Price | What you get |
|------|-------|--------------|
| **Starter** | Free | Route compliance checking, pool whitelist management, ZK witness input preparation, ZK constraint verification, trust assessment (stateless), trust comparison, trust profiling, trust threshold checks. |
| **Pro** | $49/month | Everything in Starter, plus: on-chain KYC entry reads, single and batch compliance checks (up to 100 wallets), on-chain SOVEREIGN identity reads, batch identity reads (up to 100 wallets), per-dimension identity scores. |

Both plans are rate-limited to **100 requests/min**.

### Base URL

After provisioning, all API calls go through your QuickNode add-on URL:

```
https://<your-quicknode-addon-url>
```

QuickNode provides this URL in your dashboard after you activate the add-on.

---

## Authentication

All API endpoints (except provisioning lifecycle hooks) require the **`X-INSTANCE-ID`** header. This header contains the endpoint ID assigned during provisioning. QuickNode injects it automatically when you call the add-on through your endpoint, but if you are calling the API directly, include it yourself:

```bash
curl -X GET https://<your-addon-url>/v1/kyc/WALLET_ADDRESS \
  -H "X-INSTANCE-ID: your-endpoint-id"
```

If the header is missing, you will receive:

```json
{ "error": "Missing X-INSTANCE-ID header" }
```

If the instance is not found or has been deactivated:

```json
{ "error": "Instance not found or inactive" }
```

---

## API Reference

### KYC Endpoints (Pro)

These endpoints require the **Pro** plan and read on-chain KYC data through your provisioned Solana RPC endpoint.

Whitelist entries are scoped to a transfer-hook KYC registry (one per token mint). The add-on reads the entries of the registry configured by its operator (`KYC_REGISTRY`), so a wallet's result reflects its status for that token.

#### GET /v1/kyc/:wallet

Read the whitelist entry for a single wallet.

```bash
curl -X GET https://<your-addon-url>/v1/kyc/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU \
  -H "X-INSTANCE-ID: your-endpoint-id"
```

**Success response (200):**

```json
{
  "status": "ok",
  "entry": {
    "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "kycLevel": 2,
    "jurisdiction": 1,
    "expiryTimestamp": 1735689600
  }
}
```

**Not found (404):**

```json
{ "error": "No KYC entry found for wallet" }
```

---

#### POST /v1/kyc/check

Check whether a single wallet meets compliance requirements.

```bash
curl -X POST https://<your-addon-url>/v1/kyc/check \
  -H "X-INSTANCE-ID: your-endpoint-id" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "minKycLevel": 2,
    "jurisdictionBitmask": 3
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallet` | string | Yes | Base58-encoded Solana public key. |
| `minKycLevel` | number | No | Minimum KYC level required. Defaults to `1`. |
| `jurisdictionBitmask` | number | No | Bitmask of allowed jurisdictions. |

**Success response (200):**

```json
{
  "status": "ok",
  "compliant": true,
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "kycLevel": 2,
  "jurisdiction": 1
}
```

---

#### POST /v1/kyc/batch

Batch compliance check for up to 100 wallets.

```bash
curl -X POST https://<your-addon-url>/v1/kyc/batch \
  -H "X-INSTANCE-ID: your-endpoint-id" \
  -H "Content-Type: application/json" \
  -d '{
    "wallets": [
      "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "9WzDXwBbmPg2WzGAhCuEPkSsHEQfH8q3o4SfF2iN6Uo8"
    ],
    "minKycLevel": 1,
    "jurisdictionBitmask": 7
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallets` | string[] | Yes | Array of base58 wallet addresses. Max 100. |
| `minKycLevel` | number | No | Minimum KYC level. Defaults to `1`. |
| `jurisdictionBitmask` | number | No | Bitmask of allowed jurisdictions. |

**Success response (200):**

```json
{
  "status": "ok",
  "results": [
    { "wallet": "7xKX...AsU", "compliant": true },
    { "wallet": "9WzD...Uo8", "compliant": false }
  ]
}
```

---

### Identity Endpoints (Pro)

These endpoints read SOVEREIGN identity data from Solana. Identity scores range from 0 to 10000 across five dimensions.

#### GET /v1/identity/:wallet

Read a wallet's full SOVEREIGN identity profile.

```bash
curl -X GET https://<your-addon-url>/v1/identity/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU \
  -H "X-INSTANCE-ID: your-endpoint-id"
```

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "owner": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "scores": {
      "trading": 7500,
      "civic": 3200,
      "developer": 8100,
      "infra": 4400,
      "creator": 1200
    },
    "tier": 3,
    "tierName": "Established",
    "confidence": 0.85
  }
}
```

**Not found (404):**

```json
{ "success": false, "error": "Identity not found for this wallet" }
```

---

#### POST /v1/identity/batch

Batch-read SOVEREIGN identities for up to 100 wallets.

```bash
curl -X POST https://<your-addon-url>/v1/identity/batch \
  -H "X-INSTANCE-ID: your-endpoint-id" \
  -H "Content-Type: application/json" \
  -d '{
    "wallets": [
      "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "9WzDXwBbmPg2WzGAhCuEPkSsHEQfH8q3o4SfF2iN6Uo8"
    ]
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallets` | string[] | Yes | Array of base58 wallet addresses. Max 100. |

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU": {
      "owner": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "scores": { "trading": 7500, "civic": 3200, "developer": 8100, "infra": 4400, "creator": 1200 },
      "tier": 3,
      "tierName": "Established",
      "confidence": 0.85
    },
    "9WzDXwBbmPg2WzGAhCuEPkSsHEQfH8q3o4SfF2iN6Uo8": null
  }
}
```

Wallets without an identity record return `null`.

---

#### GET /v1/identity/:wallet/dimension/:dimension

Read a single dimension score for a wallet.

```bash
curl -X GET https://<your-addon-url>/v1/identity/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU/dimension/trading \
  -H "X-INSTANCE-ID: your-endpoint-id"
```

Valid dimensions: `trading`, `civic`, `developer`, `infra`, `creator`.

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "dimension": "trading",
    "score": 7500,
    "tier": 3,
    "tierName": "Established"
  }
}
```

**Invalid dimension (400):**

```json
{
  "success": false,
  "error": "Invalid dimension \"foo\". Must be one of: trading, civic, developer, infra, creator"
}
```

---

### Trust Endpoints (Starter)

Trust endpoints are stateless -- they operate on score objects you provide rather than reading from chain. Available on all plans including Starter (free).

Score objects use the following shape:

```json
{
  "trading": 7500,
  "civic": 3200,
  "developer": 8100,
  "infra": 4400,
  "creator": 1200
}
```

All values must be numbers between 0 and 10000.

#### POST /v1/trust/assess

Compute a trust assessment from SOVEREIGN scores.

```bash
curl -X POST https://<your-addon-url>/v1/trust/assess \
  -H "Content-Type: application/json" \
  -d '{
    "scores": {
      "trading": 7500,
      "civic": 3200,
      "developer": 8100,
      "infra": 4400,
      "creator": 1200
    },
    "dimension": "trading"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scores` | object | Yes | Score object with all five dimensions. |
| `dimension` | string | No | Optional dimension to focus the assessment on. |

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "overallTrust": 0.75,
    "dimensionTrust": 0.82
  }
}
```

---

#### POST /v1/trust/compare

Compare the trust profiles of two wallets.

```bash
curl -X POST https://<your-addon-url>/v1/trust/compare \
  -H "Content-Type: application/json" \
  -d '{
    "scoresA": {
      "trading": 7500, "civic": 3200, "developer": 8100,
      "infra": 4400, "creator": 1200
    },
    "scoresB": {
      "trading": 4000, "civic": 6100, "developer": 2200,
      "infra": 7800, "creator": 5500
    }
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scoresA` | object | Yes | First wallet's score object. |
| `scoresB` | object | Yes | Second wallet's score object. |

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "comparison": {
      "trading": 3500,
      "civic": -2900,
      "developer": 5900,
      "infra": -3400,
      "creator": -4300
    }
  }
}
```

---

#### POST /v1/trust/threshold

Check whether scores meet a minimum threshold for a specific dimension.

```bash
curl -X POST https://<your-addon-url>/v1/trust/threshold \
  -H "Content-Type: application/json" \
  -d '{
    "scores": {
      "trading": 7500, "civic": 3200, "developer": 8100,
      "infra": 4400, "creator": 1200
    },
    "dimension": "trading",
    "minScore": 5000
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scores` | object | Yes | Score object with all five dimensions. |
| `dimension` | string | Yes | Dimension to check. |
| `minScore` | number | Yes | Minimum score (0-10000). |

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "meets": true,
    "dimension": "trading",
    "actualScore": 7500,
    "requiredScore": 5000
  }
}
```

---

#### POST /v1/trust/profile

Analyze a score profile: identify strongest and weakest dimensions, ranked by score.

```bash
curl -X POST https://<your-addon-url>/v1/trust/profile \
  -H "Content-Type: application/json" \
  -d '{
    "scores": {
      "trading": 7500, "civic": 3200, "developer": 8100,
      "infra": 4400, "creator": 1200
    }
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scores` | object | Yes | Score object with all five dimensions. |

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "strongest": "developer",
    "weakest": "creator",
    "ranking": [
      { "dimension": "developer", "score": 8100 },
      { "dimension": "trading", "score": 7500 },
      { "dimension": "infra", "score": 4400 },
      { "dimension": "civic", "score": 3200 },
      { "dimension": "creator", "score": 1200 }
    ]
  }
}
```

---

### Route Compliance Endpoints (Starter)

Manage a pool whitelist and validate that swap route plans only touch approved AMM pools. Available on all plans.

#### POST /v1/route/check

Check whether an entire route plan is compliant (all hops use whitelisted pools).

```bash
curl -X POST https://<your-addon-url>/v1/route/check \
  -H "Content-Type: application/json" \
  -d '{
    "routePlan": [
      { "ammKey": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2" },
      { "ammKey": "HWHvQhFmJB6gPtqJx3gjxHX1iDZMHdGAaFbBVNmsPmLa" }
    ]
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `routePlan` | object[] | Yes | Array of hop objects, each containing an `ammKey` string. |

**Success response (200):**

```json
{
  "status": "ok",
  "compliant": true,
  "violations": []
}
```

---

#### POST /v1/route/pools

Batch-check pool keys against the whitelist.

```bash
curl -X POST https://<your-addon-url>/v1/route/pools \
  -H "Content-Type: application/json" \
  -d '{
    "ammKeys": [
      "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
      "HWHvQhFmJB6gPtqJx3gjxHX1iDZMHdGAaFbBVNmsPmLa"
    ]
  }'
```

**Success response (200):**

```json
{
  "status": "ok",
  "pools": {
    "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2": true,
    "HWHvQhFmJB6gPtqJx3gjxHX1iDZMHdGAaFbBVNmsPmLa": false
  }
}
```

---

#### POST /v1/route/whitelist/add

Add a pool to the whitelist.

```bash
curl -X POST https://<your-addon-url>/v1/route/whitelist/add \
  -H "Content-Type: application/json" \
  -d '{ "ammKey": "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2" }'
```

**Success response (200):**

```json
{ "status": "ok", "success": true }
```

---

#### DELETE /v1/route/whitelist/:ammKey

Remove a pool from the whitelist.

```bash
curl -X DELETE https://<your-addon-url>/v1/route/whitelist/58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2
```

**Success response (200):**

```json
{ "status": "ok", "success": true }
```

---

### ZK Endpoints (Starter)

Generate and verify inputs for Noir zero-knowledge compliance circuits. Available on all plans.

#### POST /v1/zk/prepare

Generate witness inputs for a Noir ZK compliance circuit.

```bash
curl -X POST https://<your-addon-url>/v1/zk/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "kycLevel": 2,
    "jurisdiction": 1,
    "expiryTimestamp": 1735689600,
    "minKycLevel": 1,
    "jurisdictionBitmask": 3
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kycLevel` | number | Yes | Wallet's KYC level. |
| `jurisdiction` | number | Yes | Wallet's jurisdiction code. |
| `expiryTimestamp` | number | Yes | Unix timestamp when KYC expires. |
| `minKycLevel` | number | Yes | Minimum KYC level the circuit should enforce. |
| `jurisdictionBitmask` | number | Yes | Bitmask of allowed jurisdictions. |

**Success response (200):**

```json
{
  "status": "ok",
  "witness": {
    "kycLevel": "2",
    "jurisdiction": "1",
    "expiryTimestamp": "1735689600",
    "minKycLevel": "1",
    "jurisdictionBitmask": "3"
  }
}
```

---

#### POST /v1/zk/verify-inputs

Stateless verification that compliance constraint inputs will satisfy the circuit before generating a proof.

```bash
curl -X POST https://<your-addon-url>/v1/zk/verify-inputs \
  -H "Content-Type: application/json" \
  -d '{
    "kycLevel": 2,
    "jurisdiction": 1,
    "expiryTimestamp": 1735689600,
    "minKycLevel": 1,
    "jurisdictionBitmask": 3,
    "currentTimestamp": 1704067200
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kycLevel` | number | Yes | Wallet's KYC level. |
| `jurisdiction` | number | Yes | Wallet's jurisdiction code. |
| `expiryTimestamp` | number | Yes | Unix timestamp when KYC expires. |
| `minKycLevel` | number | Yes | Minimum KYC level to enforce. |
| `jurisdictionBitmask` | number | Yes | Bitmask of allowed jurisdictions. |
| `currentTimestamp` | number | No | Override for current time (defaults to now). |

**Success response (200):**

```json
{
  "status": "ok",
  "valid": true,
  "checks": {
    "kycLevelSufficient": true,
    "jurisdictionAllowed": true,
    "notExpired": true
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success. |
| `400` | Bad request -- missing or invalid parameters. Check the `error` field for details. |
| `404` | Resource not found -- no KYC entry or identity for the given wallet, or instance not provisioned. |
| `409` | Conflict -- instance already provisioned (provisioning lifecycle only). |
| `429` | Rate limit exceeded -- you have hit the 100 requests/min cap. Back off and retry. |
| `500` | Internal server error -- something went wrong on the server side. |

### Common Error Responses

**Missing authentication header:**

```json
{ "error": "Missing X-INSTANCE-ID header" }
```

**Instance not active:**

```json
{ "error": "Instance not found or inactive" }
```

**Missing required field:**

```json
{ "error": "Missing wallet in request body" }
```

**Batch size exceeded:**

```json
{ "error": "Batch size cannot exceed 100 wallets" }
```

**Invalid input format:**

```json
{ "error": "wallets must be a non-empty array" }
```

**Invalid dimension:**

```json
{
  "success": false,
  "error": "Invalid dimension \"foo\". Must be one of: trading, civic, developer, infra, creator"
}
```

**Invalid score object:**

```json
{
  "success": false,
  "error": "scores must include trading, civic, developer, infra, creator as numbers (0-10000)"
}
```

---

## Use Cases

### Tokenized Securities

Tokenized real-world assets (stocks, bonds, real estate) require that every holder passes KYC. Use Accredit to gate transfers:

```bash
# Before executing a token transfer, verify the recipient is KYC'd
curl -X POST https://<your-addon-url>/v1/kyc/check \
  -H "X-INSTANCE-ID: your-endpoint-id" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "RECIPIENT_WALLET",
    "minKycLevel": 2,
    "jurisdictionBitmask": 5
  }'

# If compliant == false, reject the transfer in your program logic.
```

For transfer agents processing bulk distributions, the batch endpoint handles up to 100 wallets in a single call:

```bash
curl -X POST https://<your-addon-url>/v1/kyc/batch \
  -H "X-INSTANCE-ID: your-endpoint-id" \
  -H "Content-Type: application/json" \
  -d '{
    "wallets": ["WALLET_1", "WALLET_2", "WALLET_3"],
    "minKycLevel": 2
  }'
```

### Regulated DEX

A DEX that only allows verified traders can combine route compliance with KYC checks:

1. **Whitelist approved pools** that your compliance team has reviewed:

```bash
curl -X POST https://<your-addon-url>/v1/route/whitelist/add \
  -H "Content-Type: application/json" \
  -d '{ "ammKey": "APPROVED_POOL_KEY" }'
```

2. **Validate route plans** before submitting swaps to ensure every hop goes through an approved pool:

```bash
curl -X POST https://<your-addon-url>/v1/route/check \
  -H "Content-Type: application/json" \
  -d '{
    "routePlan": [
      { "ammKey": "POOL_HOP_1" },
      { "ammKey": "POOL_HOP_2" }
    ]
  }'
```

3. **Check the trader's KYC status** before allowing the swap to execute:

```bash
curl -X POST https://<your-addon-url>/v1/kyc/check \
  -H "X-INSTANCE-ID: your-endpoint-id" \
  -H "Content-Type: application/json" \
  -d '{ "wallet": "TRADER_WALLET", "minKycLevel": 1 }'
```

### KYC-Gated Token Transfers

For programs that need to prove compliance without revealing user data on-chain, use the ZK workflow:

1. **Read the wallet's KYC entry** to get their current compliance data:

```bash
curl -X GET https://<your-addon-url>/v1/kyc/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU \
  -H "X-INSTANCE-ID: your-endpoint-id"
```

2. **Verify the inputs will satisfy the circuit** before spending resources on proof generation:

```bash
curl -X POST https://<your-addon-url>/v1/zk/verify-inputs \
  -H "Content-Type: application/json" \
  -d '{
    "kycLevel": 2,
    "jurisdiction": 1,
    "expiryTimestamp": 1735689600,
    "minKycLevel": 1,
    "jurisdictionBitmask": 3
  }'
```

3. **Generate the witness inputs** for your Noir circuit:

```bash
curl -X POST https://<your-addon-url>/v1/zk/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "kycLevel": 2,
    "jurisdiction": 1,
    "expiryTimestamp": 1735689600,
    "minKycLevel": 1,
    "jurisdictionBitmask": 3
  }'
```

4. Feed the returned `witness` object into your Noir prover. The generated proof can then be verified on-chain without exposing the underlying KYC data.

---

For support, contact the Fabrknt team through the QuickNode Marketplace or visit the project repository.
