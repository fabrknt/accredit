# Deployment — HashKey Chain Testnet (chainId 133)

Deployed 2026-06-25. Explorer: https://testnet-explorer.hsk.xyz

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| IdentityRegistry | `0xc513899e54e0b8f3b0775ace8a0cf9b4a185ed77` | https://testnet-explorer.hsk.xyz/address/0xc513899e54e0b8f3b0775ace8a0cf9b4a185ed77 |
| AmlOracle | `0xbc56838b2f04986ff450be96bc5286ad9e3b679c` | https://testnet-explorer.hsk.xyz/address/0xbc56838b2f04986ff450be96bc5286ad9e3b679c |
| ModularCompliance | `0x6af907e8879ffafb87c0e21e5078fa63335ac27a` | https://testnet-explorer.hsk.xyz/address/0x6af907e8879ffafb87c0e21e5078fa63335ac27a |
| CompliantToken (cHSP) | `0xf7d8fde15afd893a09aef4dd6a7d92cafc7fdbd8` | https://testnet-explorer.hsk.xyz/address/0xf7d8fde15afd893a09aef4dd6a7d92cafc7fdbd8 |

## Demo state (seeded by Bootstrap.s.sol)

- Alice `0xBf3Fb8780fC1104C6cCc1c55aA52F89cF51Bd826` — KYC level 2 (JP), AML-clean, holds 1000 cHSP.
- Bob `0x0AF4392a6CEdaa00479698FEAB73DF61e1CB07a6` — KYC level 2 (JP), AML-clean.
- `0x…dead` — watchlisted; AI-AML scorer attested risk **65 (high)** on-chain, then KYC'd
  to isolate AML as the blocker.

## End-to-end proof (read live from chain)

```
AmlOracle.riskOf(dead)               = (65, <ts>, 0xa605…ba64)   # AI score anchored on-chain
AmlOracle.isClean(dead,50,30d)       = false
ModularCompliance.canTransfer(alice→bob)  = (true,  "")
ModularCompliance.canTransfer(alice→dead) = (false, "recipient failed AML screen")
```

The AI-AML scorer computed the risk off-chain, anchored the verdict via
`AmlOracle.attestRisk`, and the compliance engine then blocks a transfer to the flagged
address — the full "compliance-enforced payments + AI-AML screening" loop, live.

## Transactions

- Deploy (4 contracts): `broadcast/Deploy.s.sol/133/run-latest.json`
- Bootstrap (seed identities/AML/mint): `broadcast/Bootstrap.s.sol/133/run-latest.json`
- AI-AML `attestRisk(dead, 65)`: `0x08ad74656cb5d90e2e72d7841e406075e2b456525a914d3aae2d51ea52c6dc21`
- `registerIdentity(dead)`: `0xd83eba72543836194d1beddd1ae20da20d2df261ac06c2d7650ac26824cb6c7a`

## Reproduce

See `docs/runbook-testnet.md`. Deployer key is in gitignored `.env` (throwaway testnet account).
