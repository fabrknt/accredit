# accredit — the AI that runs compliance operations on HashKey

**HashKey Chain Horizon Hackathon (Tokyo, 2026) submission.** Tracks: AI × DeFi.

On a regulated chain like HashKey the compliance *primitives* already exist (ERC-3643
permissioned tokens, AML intel like MistTrack, ZKID). What doesn't scale is the
**operations**: a human officer monitoring wallets, screening, deciding, acting, logging.
**accredit is the AI operator on top of those primitives** — it automates the compliance
operating loop with a **human-in-the-loop**, escalating only the calls a human must make.

→ Full pitch: [`docs/pitch.md`](docs/pitch.md) · Demo script: [`docs/demo-script.md`](docs/demo-script.md)
· Operator policy spec: [`docs/ai-operator-spec.md`](docs/ai-operator-spec.md)

## Live on HashKey Chain testnet (chainId 133)

Explorer: https://testnet-explorer.hsk.xyz

| Contract | Address |
|---|---|
| IdentityRegistry | [`0x0c4a5f00786c9b4a7f65d9c96d7e6f6a020afe63`](https://testnet-explorer.hsk.xyz/address/0x0c4a5f00786c9b4a7f65d9c96d7e6f6a020afe63) |
| AmlOracle | [`0x828976cc4ca8c4d243c5a6c4366145c1f499d70c`](https://testnet-explorer.hsk.xyz/address/0x828976cc4ca8c4d243c5a6c4366145c1f499d70c) |
| ModularCompliance | [`0x4be4dd8a745d8d72842c77e9849eda0691529c53`](https://testnet-explorer.hsk.xyz/address/0x4be4dd8a745d8d72842c77e9849eda0691529c53) |
| CompliantToken (cHSP) | [`0x0457d8336917075838d0acd76862f057a132d308`](https://testnet-explorer.hsk.xyz/address/0x0457d8336917075838d0acd76862f057a132d308) |
| MockHSP (test underlying) | [`0x697953a4400d78c65a93844b271b6eae5397cbe9`](https://testnet-explorer.hsk.xyz/address/0x697953a4400d78c65a93844b271b6eae5397cbe9) |
| CompliantWrapper | [`0xb4236a2679adb384fe8e6cdd68ca1e27a6d71d49`](https://testnet-explorer.hsk.xyz/address/0xb4236a2679adb384fe8e6cdd68ca1e27a6d71d49) |

Deployment record (incl. tx hashes): [`docs/deployment-testnet.md`](docs/deployment-testnet.md).

## What's here

- **`src/`** — the on-chain compliance stack (Solidity, ERC-3643-style), the AI operator's tools:
  - `IdentityRegistry` (KYC claims + freeze), `AmlOracle` (on-chain AML risk attestations),
    `ModularCompliance` (transfer/receive/redeem gates), `CompliantToken` (cHSP),
    `CompliantWrapper` (1:1 HSP→cHSP), `MockHSP`. **22 Foundry tests.**
- **`scorer/`** — the off-chain AI-AML risk model: a deterministic, explainable logistic-regression
  classifier (trained, held-out acc ~0.97); its model hash is anchored on-chain as `modelRef`.
- **`ui/`** — the compliance operator console (Next.js): a live dashboard with the **AI Compliance
  Operator** (one-click sweep → screen everyone, auto-resolve routine, escalate to a human review
  queue) plus the manual tools (screen / transfer policy / freeze / onboard / wrap).

## The AI operator (the core)

One **compliance sweep** (`/api/sweep`) screens the whole cohort, applies policy, and acts on-chain:

| Outcome | AI action |
|---|---|
| Clean | auto-onboard + anchor verdict |
| Watch (elevated) | auto-anchor + monitor |
| High (model-flagged) | auto-anchor verdict; **escalate freeze to a human** |
| Sanctions (confirmed list hit) | **auto-freeze** (contain) + **escalate recovery to a human** |
| Any irreversible value move | **never auto — human-approved** |

Live run: **5 screened / 100% coverage / 3 auto-resolved / 2 escalated / ~1 min** (vs ~15 min by
hand), every action a real on-chain tx with a full decision log. The AI proposes; the human disposes.

## Run it

```bash
# 1) contracts
forge build && forge test

# 2) AI-AML scorer
cd scorer && pnpm install --ignore-workspace && pnpm test     # train: pnpm train

# 3) operator console (live on testnet)
cd ../ui && pnpm install --ignore-workspace
cp .env.local.example .env.local    # fill RPC + addresses + PRIVATE_KEY (agent) + ALICE_KEY
pnpm dev                            # http://localhost:3010
```

In the dashboard: **Run compliance sweep** → watch the metrics + decision log → **Approve** the
escalated cases. **Reset demo** returns the cohort to a clean first-run for re-recording.

Deploy from scratch: [`docs/runbook-testnet.md`](docs/runbook-testnet.md).

## Honest scope
A working prototype of the operating-model shift, not a production compliance system. The AML model
is a hackathon-grade, explainable stand-in (designed to plug in MistTrack/Elliptic-grade intel).
Identity is per-address (full ONCHAINID / trusted-issuer is roadmap). The wrapper uses a MockHSP
stand-in until the canonical HSP token address is wired.

## Build process
Built collaboratively by **Claude Code + Codex** under a cross-review discipline (CC implements or
frames; the other reviews) — task briefs in `docs/tasks/`, reviews in `reviews/`.
