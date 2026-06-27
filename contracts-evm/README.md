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

## For judges (3-minute path)
1. **What's novel:** every other tool automates *defense* only. accredit makes one AI pass **protect AND
   grow** — a cost-center becomes a profit-center — with a human in the loop. (Why this matters, given
   HashKey already has the primitives: [`docs/pitch.md`](docs/pitch.md).)
2. **See it live:** run the UI (below) → **Run sweep now** → the console fills: KPIs, the protect review
   queue (Approve an escalated freeze), the growth opportunity inbox (Flag a prospect), the accounts
   table (risk + opportunity), and the audit log.
3. **It's real on-chain:** every protect action is a transaction on HashKey testnet — open any tx hash in
   the audit log, or the [contracts on the explorer](#live-on-hashkey-chain-testnet-chainid-133).
4. **The AI:** policy + a trained, explainable AML model ([`docs/ai-operator-spec.md`](docs/ai-operator-spec.md))
   and a transparent opportunity model ([`docs/growth-engine-spec.md`](docs/growth-engine-spec.md)); the
   ethics line — growth is advisory, routes leads to a human, never trades or front-runs.

## Live on HashKey Chain testnet (chainId 133)

Explorer: https://testnet-explorer.hsk.xyz

| Contract | Address |
|---|---|
| IdentityRegistry | [`0x0c35d7c98566166f59b40d425e96a67f74d7ec1a`](https://testnet-explorer.hsk.xyz/address/0x0c35d7c98566166f59b40d425e96a67f74d7ec1a) |
| AmlOracle | [`0x1e8b6ad17e782fa40a57178b4921ffffec7031ac`](https://testnet-explorer.hsk.xyz/address/0x1e8b6ad17e782fa40a57178b4921ffffec7031ac) |
| ModularCompliance | [`0xa645d67f748acb58e0043dfd7ce72fd30219f970`](https://testnet-explorer.hsk.xyz/address/0xa645d67f748acb58e0043dfd7ce72fd30219f970) |
| CompliantToken (cUSDC) | [`0x321a3f59b8b98babcdab10766785e76f08a5e9de`](https://testnet-explorer.hsk.xyz/address/0x321a3f59b8b98babcdab10766785e76f08a5e9de) |
| MockUSDC (test underlying) | [`0x86bcb8129ad21e187a56306c411888859ae10469`](https://testnet-explorer.hsk.xyz/address/0x86bcb8129ad21e187a56306c411888859ae10469) |
| CompliantWrapper | [`0xe9c5d0c5b393a441d1ec419e45af96d3149d0234`](https://testnet-explorer.hsk.xyz/address/0xe9c5d0c5b393a441d1ec419e45af96d3149d0234) |

Deployment record (incl. tx hashes): [`docs/deployment-testnet.md`](docs/deployment-testnet.md).

## What's here
- **`src/`** — the on-chain compliance stack (Solidity, ERC-3643-style) = the operator's tools:
  IdentityRegistry (KYC + freeze), AmlOracle (on-chain AML attestations), ModularCompliance
  (transfer/receive/redeem gates), CompliantToken (cUSDC), CompliantWrapper, MockUSDC. **22 Foundry tests.**
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
trusted-issuer is roadmap); the wrapper uses a MockUSDC stand-in.

## Build process
Built collaboratively by **Claude Code + Codex** under a cross-review discipline — task briefs in
`docs/tasks/`, reviews in `reviews/`.
