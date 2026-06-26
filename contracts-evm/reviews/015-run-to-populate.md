# Review 015 — Run-to-populate console (sweep = single source of state)

**Branch: `task/015-run-to-populate`. Design + impl: CC. Review: CC self-verified (Codex bg unreliable).**

## Why
Hiro: items shouldn't be displayed by default; running "Run sweep now" should populate them — matching
real ops flow (run the screening pass, then review results). Chose option A (full populate-on-run).

## What changed
- `/api/sweep` is now the **single source of the whole console state**: returns `accounts` (per-account
  risk + opportunity + status + action), `kpis`, `escalations` (protect queue), `prospects` (growth inbox),
  `log` (audit), `metrics`. (Adds balance + identity reads + opportunity per account.)
- `AIOperator.tsx` is now the **full console**: before a sweep = a standby panel (header + Run button +
  "Console is on standby"); after a sweep it renders, all from the result — KPI bar (protect + growth),
  the sweep summary line, the Protect review queue (Approve/Dismiss), the Growth opportunity inbox
  (`GrowthInbox`), the Monitored-accounts table (risk + opportunity columns), and the Audit-trail log.
- `page.tsx` slimmed: removed the always-on server-rendered KPI/table/growth + the page-load data fetch
  (which could also fail and break the page). Now renders Header + AI console + manual Operator actions +
  Demo controls. `OperatorNav` → AI sweep / Operator actions.

## Verification (CC, build + live)
- `pnpm build` clean.
- Before sweep: page shows the standby note + Run button; **no KPI/table/inbox rendered** (confirmed: those
  grep to 0 in the initial HTML).
- POST `/api/sweep` returns the full state (29s): accounts 5, prospects 4, escalations 2,
  kpis {monitored 5, openAlerts 2, contained 1, prospects 4, strategic 1, flows 1}; account picture
  Acme clean/strategic · Beacon clean/priority · New Applicant clean/priority · Zenith high/priority ·
  Sanctioned sanctions/lead — protect + grow in one pass.
- Boundary: client bundle has no key leak; AIOperator (client) imports no server/key module.
- (Codex background read-only review stalled again this session — CC ran the checks.)

## Decision
Merged to `master`. The console now starts on standby and populates entirely from one AI sweep —
the "Run sweep now → everything appears" flow Hiro asked for, and the strongest demo beat.
