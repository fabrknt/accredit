# Deployment — HashKey Chain Testnet (chainId 133)

Deployed 2026-06-25 (full stack incl. CompliantWrapper). Explorer: https://testnet-explorer.hsk.xyz

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| IdentityRegistry | `0x0c4a5f00786c9b4a7f65d9c96d7e6f6a020afe63` | https://testnet-explorer.hsk.xyz/address/0x0c4a5f00786c9b4a7f65d9c96d7e6f6a020afe63 |
| AmlOracle | `0x828976cc4ca8c4d243c5a6c4366145c1f499d70c` | https://testnet-explorer.hsk.xyz/address/0x828976cc4ca8c4d243c5a6c4366145c1f499d70c |
| ModularCompliance | `0x4be4dd8a745d8d72842c77e9849eda0691529c53` | https://testnet-explorer.hsk.xyz/address/0x4be4dd8a745d8d72842c77e9849eda0691529c53 |
| CompliantToken (cHSP) | `0x0457d8336917075838d0acd76862f057a132d308` | https://testnet-explorer.hsk.xyz/address/0x0457d8336917075838d0acd76862f057a132d308 |
| MockHSP (test underlying) | `0x697953a4400d78c65a93844b271b6eae5397cbe9` | https://testnet-explorer.hsk.xyz/address/0x697953a4400d78c65a93844b271b6eae5397cbe9 |
| CompliantWrapper | `0xb4236a2679adb384fe8e6cdd68ca1e27a6d71d49` | https://testnet-explorer.hsk.xyz/address/0xb4236a2679adb384fe8e6cdd68ca1e27a6d71d49 |

## Demo state (seeded by Bootstrap.s.sol)

- Alice `0xBf3Fb8780fC1104C6cCc1c55aA52F89cF51Bd826` — KYC level 2 (JP), AML-clean, holds 1000 cHSP.
- Bob `0x0AF4392a6CEdaa00479698FEAB73DF61e1CB07a6` — KYC level 2 (JP), AML-clean.
- `0x…dead` — watchlisted; AI-AML scorer attested risk **65 (high)** on-chain, then KYC'd
  to isolate AML as the blocker.

## End-to-end proofs (read live from chain)

**AI-AML transfer gate:**
```
AmlOracle.riskOf(dead)               = (65, <ts>, 0xa605…ba64)   # AI score anchored on-chain
ModularCompliance.canTransfer(alice→bob)  = (true,  "")
ModularCompliance.canTransfer(alice→dead) = (false, "recipient failed AML screen")
```

**1:1 compliant wrapping (HSP → cHSP):** deployer wrapped 300 MockHSP → 300 cHSP, then
unwrapped 100 → final deployer 200 cHSP / 300 MockHSP, wrapper holds 200 MockHSP (1:1 backing).

## Transactions

- Deploy (4 core contracts): `broadcast/Deploy.s.sol/133/run-latest.json`
- Bootstrap (seed identities/AML/mint): `broadcast/Bootstrap.s.sol/133/run-latest.json`
- DeployWrapper (MockHSP + wrapper + grant ISSUER_ROLE): `broadcast/DeployWrapper.s.sol/133/run-latest.json`
- AI-AML `attestRisk(dead, 65)`: `0xfd41da3c9716cc9212926b23bb2779642dfafeeef36f48f459cced2b0ca2cf4b`

## Reproduce

See `docs/runbook-testnet.md`. Deployer key is in gitignored `.env` (throwaway testnet account).

> Note: an earlier partial deployment (core only, pre-`burnFrom`) was superseded by this
> full-stack redeploy so that wrapper unwrap (which calls `cHSP.burnFrom`) works on-chain.
