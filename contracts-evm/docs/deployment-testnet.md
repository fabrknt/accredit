# Deployment — HashKey Chain Testnet (chainId 133)

Deployed 2026-06-25 (full stack incl. CompliantWrapper). Explorer: https://testnet-explorer.hsk.xyz

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| IdentityRegistry | `0x0c35d7c98566166f59b40d425e96a67f74d7ec1a` | https://testnet-explorer.hsk.xyz/address/0x0c35d7c98566166f59b40d425e96a67f74d7ec1a |
| AmlOracle | `0x1e8b6ad17e782fa40a57178b4921ffffec7031ac` | https://testnet-explorer.hsk.xyz/address/0x1e8b6ad17e782fa40a57178b4921ffffec7031ac |
| ModularCompliance | `0xa645d67f748acb58e0043dfd7ce72fd30219f970` | https://testnet-explorer.hsk.xyz/address/0xa645d67f748acb58e0043dfd7ce72fd30219f970 |
| CompliantToken (cUSDC) | `0x321a3f59b8b98babcdab10766785e76f08a5e9de` | https://testnet-explorer.hsk.xyz/address/0x321a3f59b8b98babcdab10766785e76f08a5e9de |
| MockUSDC (test underlying) | `0x86bcb8129ad21e187a56306c411888859ae10469` | https://testnet-explorer.hsk.xyz/address/0x86bcb8129ad21e187a56306c411888859ae10469 |
| CompliantWrapper | `0xe9c5d0c5b393a441d1ec419e45af96d3149d0234` | https://testnet-explorer.hsk.xyz/address/0xe9c5d0c5b393a441d1ec419e45af96d3149d0234 |

## Demo state (seeded by Bootstrap.s.sol)

- Alice `0xBf3Fb8780fC1104C6cCc1c55aA52F89cF51Bd826` — KYC level 2 (JP), AML-clean, holds 1000 cUSDC.
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

**1:1 compliant wrapping (USDC → cUSDC):** deployer wrapped 300 MockUSDC → 300 cUSDC, then
unwrapped 100 → final deployer 200 cUSDC / 300 MockUSDC, wrapper holds 200 MockUSDC (1:1 backing).

## Transactions

- Deploy (4 core contracts): `broadcast/Deploy.s.sol/133/run-latest.json`
- Bootstrap (seed identities/AML/mint): `broadcast/Bootstrap.s.sol/133/run-latest.json`
- DeployWrapper (MockUSDC + wrapper + grant ISSUER_ROLE): `broadcast/DeployWrapper.s.sol/133/run-latest.json`
- AI-AML `attestRisk(dead, 65)`: `0xfd41da3c9716cc9212926b23bb2779642dfafeeef36f48f459cced2b0ca2cf4b`

## Reproduce

See `docs/runbook-testnet.md`. Deployer key is in gitignored `.env` (throwaway testnet account).

> Note: an earlier partial deployment (core only, pre-`burnFrom`) was superseded by this
> full-stack redeploy so that wrapper unwrap (which calls `cUSDC.burnFrom`) works on-chain.
