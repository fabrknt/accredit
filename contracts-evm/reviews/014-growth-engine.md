# Review 014 — Growth engine (offensive AI)

**Branch: `task/014-growth-engine`. Spec + impl: CC. Review: CC self-verified (Codex bg review unreliable this session).**

## Why
Hiro: the AI was purely defensive (compliance). Flip it to also be offensive — surface high-value
prospects / important flows for the BD team. Turns accredit from a cost-center (Protect) into a
profit-center too (Grow), answers "AI is too passive", and differentiates from every compliance tool.
Spec confirmed pre-build (docs/growth-engine-spec.md), incl. the ethics framing.

## What was built (advisory; no on-chain writes for growth)
- `lib/opportunity.ts` — transparent opportunity scorer (signals: strategic / inbound(intent) / volume /
  growth; weights sum 100) → score + tier (lead/priority/strategic) + intent flag + explainable breakdown
  + `recommendedAction`.
- `lib/cohort.ts` — per-member growth signals.
- `app/page.tsx` — opportunity computed server-side per account; KPI bar gains growth cards (Prospects /
  Strategic / Notable flows, tinted); Monitored-accounts table gains an Opportunity column; a new
  Growth — opportunity inbox section; header reframed "AI Operations · Protect + Grow".
- `components/GrowthInbox.tsx` — client inbox: prospects with tier, intent + "valuable · risk-flagged"
  badges, recommended action, and HITL Flag/Assign/Dismiss (UI state). Ethics note inline.
- `app/api/sweep` — also counts prospects on the same pass; metric surfaced in the AI operator results.

## Ethics framing (in UI + pitch)
Surfaces public on-chain signals to prioritize legitimate BD outreach — does NOT trade, front-run, or
act on a pending tx; routes leads to a human. Advisory only.

## Verification (CC)
- `pnpm build` clean. Live render: Protect+Grow header, growth KPIs, Opportunity column, Growth inbox
  with all 4 prospects (Acme strategic / Beacon priority / New Applicant priority+intent / Zenith
  priority+risk-flagged), Sanctioned excluded; Flag button; ethics note.
- Tier check matches design (Acme→strategic, Beacon→priority, New Applicant→priority+intent (41),
  Zenith→priority (62), Sanctioned→lead/excluded).
- Boundary self-check: GrowthInbox has no server/key import; opportunity.ts is pure; OperatorNav
  grp-growth target exists; `.next/static` client bundle has no key leak.
- Codex background read-only review stalled repeatedly this session (env limitation); CC ran the
  equivalent checks above.

## Decision
Merged to `master`. accredit is now a two-engine AI operations layer — Protect + Grow — on one sweep.
