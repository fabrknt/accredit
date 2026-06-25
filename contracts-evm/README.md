# accredit — HashKey Chain (EVM) compliance stack

EVM rebuild of accredit's on-chain compliance enforcement, targeting the **HashKey
Chain Horizon Hackathon (Tokyo, Jun 18–Jul 11 2026)**. Axis: **compliance-enforced
HSP payments + AI-AML transfer screening**.

The chain-agnostic core, KYC providers, and institutional UI are reused from the
parent monorepo (TypeScript). Only the on-chain layer is rebuilt here in Solidity,
mapping accredit's Solana programs onto an ERC-3643-style design.

## Contracts (Day 1 skeleton — compiles, 13/13 tests pass)

Cross-reviewed by Claude Code + Codex (3 rounds). All holder-controlled value paths
(transfer, transferFrom, burn) are compliance-gated; `forcedTransfer` is AGENT-only and
evented; `mint` is gated so supply can never reach an unverified/sanctioned/frozen address.

| Solidity | Maps from (Solana) | Role |
|---|---|---|
| `IdentityRegistry.sol` | `compliant-registry` | KYC claims (level, jurisdiction, expiry) + freeze, written by the off-chain KYC bridge (`AGENT_ROLE`) |
| `AmlOracle.sol` | *(new — AI×DeFi bridge)* | Per-address AML risk attestations written by the off-chain AI scorer (`SCORER_ROLE`) |
| `ModularCompliance.sol` | compliance logic in `transfer-hook` | Gates: `canTransfer` (both parties KYC+AML+limit), `canReceive` (mint), `canRedeem` (burn: freeze+AML, KYC-lapse exempt to avoid fund-trapping) |
| `CompliantToken.sol` | `transfer-hook` (Token-2022) | ERC-20 (cHSP). P2P gated via `_update`; `mint`/`burn` gated; `forcedTransfer` = agent recovery (evented) |

### Agent / issuer powers (ERC-3643-style)
- `IdentityRegistry.setAddressFrozen` — freeze blocks send AND receive AND redeem.
- `CompliantToken.forcedTransfer` — court-ordered recovery of frozen/compromised funds.
- Redemption carve-out: a holder with merely lapsed KYC can still `burn` (redeem) their own funds; frozen/sanctioned holders cannot.

### Known roadmap gaps (Day 2+, flagged in review)
- Identity/wallet separation + trusted-issuer claims (full ONCHAINID model) — currently per-address.
- Richer transfer-level AML context (velocity, linked-wallet clustering, travel-rule) — on-chain anchors the verdict, the off-chain AI owns the richness.

## HashKey Chain — verified live 2026-06-25

- **Testnet** chainId `133` (0x85), RPC `https://testnet.hsk.xyz`, explorer `https://testnet-explorer.hsk.xyz`
- **Mainnet** chainId `177` (0xb1), RPC `https://mainnet.hsk.xyz`, explorer `https://hashkey.blockscout.com`
- Standard OP-stack L2 (predeploys at `0x4200...`); native gas token **HSK**.
- HSP = **HashKey Stablecoin Program** (PayFi settlement). Exact stablecoin token
  address still TODO (docs "Token Contracts" page); MVP can deploy its own cHSP.

## Build / test / deploy

```bash
forge build
forge test
# deploy (needs a funded key + testnet faucet):
PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url hashkey_testnet --broadcast
```

## Next (Day 2+)

- Pin the canonical HSP stablecoin address; add `CompliantWrapper.sol` (1:1 HSP → cHSP).
- Wire the off-chain AI-AML scorer to `AmlOracle.attestRisk` (reuse accredit-core).
- Bridge `accredit-kyc-providers` → `IdentityRegistry.registerIdentity`.
- Deploy to testnet, then mainnet (hard requirement); connect institutional UI.
