# HashKey Chain Mainnet deployment runbook

The hackathon **requires** the smart contracts to be deployed on **HashKey Chain mainnet**
(chainId 177) — testnet-only forfeits demo eligibility. This deploys the same stack used on
testnet.

## 1. Fund the deployer (human step — needs real HSK)
Deployer address: **`0x71B9f1287B208D49f6e512Ad09ff15e33C464F4C`** (key in gitignored `.env.mainnet`).
Send it a small amount of **HSK** (deploy gas is tiny — testnet used ~0.0002 HSK total; allow a
little headroom). HSK can be acquired on HashKey Global / bridged.

## 2. Deploy the core stack (satisfies the mainnet requirement)
```bash
cd contracts-evm
set -a && . ./.env.mainnet && set +a
forge script script/Deploy.s.sol --rpc-url hashkey_mainnet --broadcast
# capture the 4 printed addresses → fill REGISTRY/AML/COMPLIANCE/TOKEN in .env.mainnet
```
That deploys IdentityRegistry, AmlOracle, ModularCompliance, CompliantToken (cUSDC) on mainnet —
enough for eligibility.

## 3. (Optional) seed + wrapper for a mainnet demo
```bash
set -a && . ./.env.mainnet && set +a
forge script script/Bootstrap.s.sol   --rpc-url hashkey_mainnet --broadcast   # demo identities/AML/mint
forge script script/DeployWrapper.s.sol --rpc-url hashkey_mainnet --broadcast # MockUSDC + wrapper
```

## 4. After deploy
- Record the mainnet addresses + explorer links (https://hashkey.blockscout.com) in the submission.
- Point `ui/.env.local` at the mainnet addresses (+ `CHAIN_ID=177`, mainnet RPC) for a mainnet demo.

## Note on real USDC
`USDC` (HashKey mainnet) = `0x054ed45810DbBAb8B27668922D110669c9D88D0a` (**6 decimals**). The current
`CompliantWrapper`/`cUSDC` are 18-decimals (matching the testnet `MockUSDC` stand-in). Wrapping the
real 6-decimal USDC 1:1 needs a decimals-aware wrapper — a small production change (roadmap). For the
hackathon, the core stack on mainnet satisfies the deployment requirement; the live wrap/unwrap demo
runs on testnet with the test USDC stand-in.
