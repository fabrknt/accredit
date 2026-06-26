# accredit — the AI operations layer for regulated on-chain finance

**HashKey Chain Horizon Hackathon (Tokyo, 2026) submission.** Tracks: AI × DeFi.

On a regulated chain like HashKey the compliance *primitives* already exist (ERC-3643 permissioned
tokens, AML intel like MistTrack, ZKID). What doesn't scale is the **operations** — humans
monitoring, screening, deciding, acting — and that work is purely defensive today. **accredit is the
AI operator on top of those primitives.** One sweep does two jobs, with a **human in the loop**:

- **Protect** — screen every account, auto-onboard the clean, anchor AML verdicts on-chain,
  auto-contain confirmed sanctions, escalate judgment calls + irreversible actions to a review queue.
- **Grow** — on the same pass, surface high-value prospects / intent signals for the BD team
  (advisory; routes leads to a human, does not trade or front-run).

The console starts on **standby**; one **Run sweep now** populates everything — KPIs, the protect
review queue, the growth opportunity inbox, the monitored-accounts table (risk + opportunity), and a
full on-chain audit log.

→ Pitch: [`docs/pitch.md`](docs/pitch.md) · Demo script: [`docs/demo-script.md`](docs/demo-script.md)
· Specs: [`docs/ai-operator-spec.md`](docs/ai-operator-spec.md), [`docs/growth-engine-spec.md`](docs/growth-engine-spec.md)

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
- **`src/`** — the on-chain compliance stack (Solidity, ERC-3643-style) = the operator's tools:
  IdentityRegistry (KYC + freeze), AmlOracle (on-chain AML attestations), ModularCompliance
  (transfer/receive/redeem gates), CompliantToken (cHSP), CompliantWrapper, MockHSP. **22 Foundry tests.**
- **`scorer/`** — the off-chain AI-AML risk model: a deterministic, explainable logistic-regression
  classifier (held-out acc ~0.97); its model hash is anchored on-chain as `modelRef`. **14 tests.**
- **`ui/`** — the **AI operations console** (Next.js): standby → one sweep → protect queue + growth
  inbox + monitored accounts + audit log; collapsed manual sections (interventions / issuance ops).

## The AI operations sweep (`/api/sweep` — one pass, two jobs)

**Protect** policy:

| Outcome | AI action |
|---|---|
| Clean | auto-onboard + anchor verdict |
| Watch | auto-anchor + monitor |
| High (model-flagged) | auto-anchor; **escalate freeze to a human** |
| Sanctions (confirmed list hit) | **auto-freeze** + **escalate recovery to a human** |
| Any irreversible value move | **never auto — human-approved** |

**Grow** (advisory): scores opportunity (strategic / inbound-intent / volume / growth) → tiers
(lead / priority / strategic) → surfaces priority+strategic prospects for the BD team with a
recommended action and HITL Flag/Assign/Dismiss. No on-chain action; public signals only.

Live sweep: 5 screened / 100% coverage / auto-resolved + escalated + prospects surfaced in ~1 min
vs ~15 min manual — every protect action a real on-chain tx.

## Run it

```bash
forge build && forge test                                   # contracts
cd scorer && pnpm install --ignore-workspace && pnpm test   # AML model (train: pnpm train)
cd ../ui && pnpm install --ignore-workspace
cp .env.local.example .env.local    # RPC + addresses + PRIVATE_KEY (agent) + ALICE_KEY
pnpm dev                            # http://localhost:3010
```

In the console: **Run sweep now** → the console fills → **Approve** the escalated protect cases and
**Flag** the growth prospects. **Demo controls → Reset cohort** returns to a clean first-run.
Deploy from scratch: [`docs/runbook-testnet.md`](docs/runbook-testnet.md).

## Honest scope
A working prototype of the operating-model shift, not a production system. The AML model is a
hackathon-grade, explainable stand-in (designed to plug in MistTrack/Elliptic-grade intel); growth
signals are partly demo-seeded (testnet history is thin); identity is per-address (full ONCHAINID /
trusted-issuer is roadmap); the wrapper uses a MockHSP stand-in.

## Build process
Built collaboratively by **Claude Code + Codex** under a cross-review discipline — task briefs in
`docs/tasks/`, reviews in `reviews/`.
