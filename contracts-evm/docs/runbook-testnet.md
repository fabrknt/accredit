# HashKey Testnet Runbook

This repo ignores `.env`; only `.env.example` is committed.

## 1. Fund the deployer

Get testnet HSK from the HashKey faucet, then set up a local `.env`:

```bash
cp .env.example .env
```

Fill in:

```bash
PRIVATE_KEY=0x...
HASHKEY_EXPLORER_KEY=...
DEMO_ALICE=0x...
DEMO_BOB=0x...
```

Notes:
- HashKey testnet RPC: `https://testnet.hsk.xyz`
- Chain ID: `133`
- Explorer: `https://testnet-explorer.hsk.xyz`
- `HASHKEY_EXPLORER_KEY` is optional unless you use explorer API verification.

Load the env into your shell:

```bash
set -a
source .env
set +a
```

## 2. Deploy the stack

Broadcast the deploy script:

```bash
forge script script/Deploy.s.sol --rpc-url hashkey_testnet --broadcast
```

Copy the four addresses printed by the script and export them:

```bash
export REGISTRY=0x...
export AML=0x...
export COMPLIANCE=0x...
export TOKEN=0x...
```

## 3. Bootstrap the demo state

Seed two demo identities, AML attestations, and mint demo cUSDC to `DEMO_ALICE`:

```bash
forge script script/Bootstrap.s.sol --rpc-url hashkey_testnet --broadcast
```

Bootstrap details:
- `DEMO_ALICE` and `DEMO_BOB` are registered at KYC level `2`
- Jurisdiction is `392` (Japan)
- Expiry is `0` (no expiry)
- AML scores are demo-low and tagged with an on-chain `modelRef`
- `DEMO_ALICE` receives `1000e18` cUSDC

## 4. Sanity-check with `cast`

Run the included verification helper:

```bash
bash script/verify.sh
```

Equivalent direct calls:

```bash
cast call "$TOKEN" "name()(string)" --rpc-url https://testnet.hsk.xyz
cast call "$TOKEN" "symbol()(string)" --rpc-url https://testnet.hsk.xyz
cast call "$REGISTRY" "isVerified(address,uint8)(bool)" "$DEMO_ALICE" 1 --rpc-url https://testnet.hsk.xyz
cast call "$AML" "isClean(address,uint8,uint64)(bool)" "$DEMO_ALICE" 50 2592000 --rpc-url https://testnet.hsk.xyz
```

Expected results:
- token name = `Compliant USDC`
- token symbol = `cUSDC`
- `isVerified(..., 1)` = `true`
- `isClean(..., 50, 30 days)` = `true`

## 5. Verify on the explorer

Open the deployed addresses on HashKey testnet explorer:

```bash
open "https://testnet-explorer.hsk.xyz/address/$REGISTRY"
open "https://testnet-explorer.hsk.xyz/address/$AML"
open "https://testnet-explorer.hsk.xyz/address/$COMPLIANCE"
open "https://testnet-explorer.hsk.xyz/address/$TOKEN"
```

If you want source verification through Foundry and have an explorer API key:

```bash
forge verify-contract --chain 133 --verifier blockscout --verifier-url https://testnet-explorer.hsk.xyz/api "$REGISTRY" src/IdentityRegistry.sol:IdentityRegistry
forge verify-contract --chain 133 --verifier blockscout --verifier-url https://testnet-explorer.hsk.xyz/api "$AML" src/AmlOracle.sol:AmlOracle
forge verify-contract --chain 133 --verifier blockscout --verifier-url https://testnet-explorer.hsk.xyz/api "$COMPLIANCE" src/ModularCompliance.sol:ModularCompliance --constructor-args "$(cast abi-encode "constructor(address,address,address)" "$(cast wallet address --private-key "$PRIVATE_KEY")" "$REGISTRY" "$AML")"
forge verify-contract --chain 133 --verifier blockscout --verifier-url https://testnet-explorer.hsk.xyz/api "$TOKEN" src/CompliantToken.sol:CompliantToken --constructor-args "$(cast abi-encode "constructor(string,string,address,address)" "Compliant USDC" "cUSDC" "$(cast wallet address --private-key "$PRIVATE_KEY")" "$COMPLIANCE")"
```
