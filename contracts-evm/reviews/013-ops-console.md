# Review 013 — Compliance operations console restructure

**Branch: `task/013-ops-console`. Design + impl: CC. Review: CC self-verified (Codex bg review stalled).**

## Why
Hiro: the screen looked demo-y; a credible real-operator console raises the win case (it makes the
"AI runs compliance operations" claim believable to judges, and credibility drives the real prize =
institutional follow-up). Agreed, with the nuance that value must still read in a 3-min demo — so:
ops-console structure, with manual-vs-AI expressed as efficiency, demo scaffolding tucked away.

## What changed (backend reused; UI reframed)
- Header → "Compliance Operations Console" (ops framing, not a pitch line).
- **KPI bar** at top (MonitorSummary, relabeled): Monitored accounts / Open alerts (high risk) /
  Contained (frozen) / Pending onboarding / KYC verified / supply — computed from live cohort state.
- **Monitored accounts** table now sourced from the **cohort** (the AI's watched set), not demo trio.
- Layout regrouped: 1 Automated screening (AIOperator) → 2 Monitored accounts → 3 Operator actions
  (the manual panels as tools). OperatorNav updated to match.
- AIOperator reframed as a continuous automation surface ("Run sweep now" + status), reset removed.
- **Demo scaffolding tucked away**: a small dashed "Demo controls" footer (`DemoControls.tsx`) holds
  the cohort reset, out of the primary surface.

## Verification (CC, build + live + self-check)
- `pnpm build` clean. Live render shows: ops header, KPI bar, Automated screening, cohort accounts
  (Acme/Zenith…) in the monitored table, Operator actions, Demo controls footer + Reset cohort.
- Self-checks (the exact items the Codex pass would cover; Codex bg run stalled, 0 bytes, stopped):
  1. No dangling `resetting`/`resetDemo` refs in AIOperator. 2. OperatorNav targets
  (grp-ai/grp-monitor/grp-tools) all exist as page anchors. 3. `DemoControls` imports no
  server/key module (only `/api/reset`). 4. `.next/static` client bundle has no key leakage.

## Decision
Merged to `master`. The dashboard now reads as a compliance operator's working console, with the AI
automation as the headline and demo controls de-emphasized.
