# Growth engine — spec (for sign-off before implementation)

## The shift
accredit today is **defensive** (Risk/Compliance: screen → contain → enforce). This adds an
**offensive** engine (Growth) on the same AI pass. accredit becomes the **AI operations layer for
regulated on-chain finance: Protect + Grow** — one sweep, two jobs.

Pitch line: *the same AI that keeps you compliant grows your book.*

## Ethics framing (states in the UI + pitch — non-negotiable)
The Growth engine surfaces **public on-chain signals** to help the chain's BD / onboarding team
**prioritize legitimate outreach** — the analysis relationship managers already do by hand, automated.
It does **NOT** trade on the information, front-run, or act on anyone's pending transaction. It only
**routes leads to a human** (advisory). No on-chain action — it's lead prioritization, not market activity.

## Opportunity score (mirror of the risk score — transparent, explainable)
Per account, a 0–100 opportunity score from public/provided signals:
- **holdings value** — cHSP balance held (on-chain, real).
- **activity volume** — throughput / engagement (demo signal; on-chain history is thin on testnet).
- **strategic alignment** — holds/uses HashKey-priority assets (HSP / RWA / key protocols).
- **inbound capital (intent)** — large recent inbound / accumulation = "about to do something important."
- **growth** — rising activity.

Weighted → score + **tier**: `Lead (0–39)` / `Priority (40–69)` / `Strategic (70–100)`, with an
explainable per-signal breakdown (same style as the risk breakdown). Honest note: on testnet,
volume/inbound/growth are config-driven demo signals; holdings is real on-chain.

## What the sweep produces (one pass, two outputs)
The existing sweep already does Risk. It now ALSO computes opportunity per account and emits **Growth
findings**. No new on-chain writes for Growth (advisory only).

## Growth queue / Opportunity inbox (mirror of the risk review queue)
Surfaces Priority + Strategic prospects and intent-flagged flows, each with:
- account, opportunity score + tier, the signals that fired, and a **recommended action**:
  - **Strategic** → "Assign an RM; fast-track onboarding."
  - **Priority** → "Prioritize onboarding / outreach."
  - **Notable inbound flow** → "Time-sensitive outreach."
- **HITL**: a human acts — **Flag for outreach / Assign / Dismiss** (UI state; no tx). The AI surfaces;
  the BD officer decides.

## KPIs added to the top bar (growth side)
- Prospects identified (Priority + Strategic)
- Strategic leads (top tier)
- Notable inbound flows
- (optional) Pipeline value = Σ holdings of surfaced prospects

## UI changes
- Header → "AI operations: **Protect + Grow**".
- KPI bar gains the growth metrics above (alongside risk metrics).
- **Monitored accounts** table gains an **Opportunity** column (score + tier) next to risk — each
  account shown on both dimensions.
- A **Growth — Opportunity inbox** section (mirror of the risk work queue) under the AI operator.
- Sweep summary shows both: "contained X / escalated Y (risk) · Z prospects surfaced (growth)."

## Demo cohort (extend the existing 5)
Add per-member growth signals so the same accounts show a Protect + Grow picture, e.g.:
- Acme Treasury → high holdings + strategic ⇒ **Strategic** prospect.
- Beacon Fund → moderate ⇒ **Priority**.
- New Applicant → large **inbound** ⇒ Priority + "time-sensitive outreach".
- Zenith OTC → high-risk (escalated) AND notable flow ⇒ shows the tension: valuable but risky → onboard carefully.
- Sanctioned Wallet → contained; not a prospect.
(So one sweep contains the bad actor, escalates the ambiguous, AND surfaces 2–3 prospects.)

## Build footprint (after sign-off)
- `lib/opportunity.ts` — opportunity scorer (pure, weighted, explainable) + tiering + recommended action.
- Extend `lib/cohort.ts` — per-member growth signals.
- Extend `/api/sweep` — also compute + return growth findings (no extra on-chain writes).
- UI: growth KPI cards, an Opportunity column in the accounts table, a Growth inbox component
  (Flag/Assign/Dismiss), reframed header + sweep summary.
- Honest scope: advisory lead-prioritization prototype on public signals; testnet signals partly synthetic.
