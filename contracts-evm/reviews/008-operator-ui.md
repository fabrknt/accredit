# Review 008 — Operator-viewpoint UI restructure

**Branch: `task/008-operator-ui`. Design + impl: CC. Reviewer: Codex read-only cross-pass.**

## Why
Hiro: the linear "story" still felt like features forced into an order. The truthful frame is the
**operator's** mental model — continuous monitoring + event-driven response — not a timeline. Confirmed:
this matches the real regulated-token operating lifecycle (ERC-3643 / HashKey's own RWA platform with
"post-issuance monitoring"). So the UI is reorganized by operator **job**, and the linear narrative moves
to the demo (C).

## What changed
- Dashboard regrouped into 4 operator jobs (with `grp-*` anchors + an `OperatorNav`):
  1. **Monitor** — `MonitorSummary` count cards (participants / verified / high-risk / frozen / supply /
     backing) + the Identity & Risk table (the standing home).
  2. **Screen & decide** — AML screening + anchor.
  3. **Enforce & respond** — Transfer Policy & Enforcement (canTransfer + execute, allowed vs blocked) + Agent console.
  4. **Issuance ops** — **new Onboard panel** (KYC register + initial AML screen) + Wrap/Unwrap.
- Added `app/api/onboard/route.ts` (registerIdentity → runScorer → attestRisk, agent-signed).
- Removed the linear `StorySteps` strip and the redundant `HoldingsCard`.

## Verification (CC, live on testnet)
- `pnpm build` clean. Served HTML shows OperatorNav, 4 group anchors, MonitorSummary cards, Onboard panel,
  Transfer Policy.
- **Onboard end-to-end:** `/api/onboard` on a fresh address → register + screen (score 17 low) →
  `can-transfer alice→that address` returns **allowed** (proves the participant is now eligible).

## Codex cross-pass (read-only): CHANGES → fixed
- OperatorNav targets match `grp-*` ids; onboard ABI args correct; agent signing correct; Onboard client
  component has no key/server leak; no dangling HoldingsCard/StorySteps refs.
- **P1 (fixed):** onboard route didn't check `receipt.status` on its two waits (inconsistent with the other
  routes) — a reverted register/attest could report success. Added `status !== "success"` guards to both.

## Decision
Approved and merged to `master`. The dashboard now reflects how a compliance operator actually works.
