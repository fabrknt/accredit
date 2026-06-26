# accredit — demo script (台本): Protect + Grow, one AI sweep

Target **~3 min**. English narration (judges are international). Everything runs **live on
HashKey Chain testnet (chainId 133)** in the console (`ui/`, http://localhost:3010). The
punchline: one click ("Run sweep now") and the whole operations console fills — protecting AND
growing — with a human in the loop and a full on-chain audit trail.

**One-line pitch:** *accredit is the AI operations layer for regulated on-chain finance on HashKey
— one pass protects (screen, contain, enforce) and grows (surface high-value prospects), escalating
only the calls a human must make.*

---

## Beat 0 — The real bottleneck (0:00–0:30)

> "On a regulated chain like HashKey, the compliance *primitives* already exist — permissioned
> tokens, AML screening, identity. What doesn't scale is the **operations**: a human officer
> monitoring, screening, deciding, acting — and today that work is purely defensive. accredit is the
> AI that runs those operations: it protects *and* grows the book, with a human in the loop."

## Beat 1 — Standby (0:30–0:50)

> "This is the operations console, live on HashKey. The AI hasn't run yet — it's on standby. One
> action: run the sweep."

Show: the clean standby screen — header + "Run sweep now".

## Beat 2 — One sweep fills the console (0:50–1:40)

> "One pass screens every account."

Click **Run sweep now** (~1 min). As it completes, the console populates:

> "100% coverage. It auto-onboarded the clean applicants, anchored every verdict on-chain, and did it
> in about a minute — versus roughly fifteen by hand, and only if you check everyone, which teams
> don't. Every number here is backed by a real on-chain transaction."

Show: the KPI bar (protect + ↗growth) and the sweep summary line.

## Beat 3 — Protect: human in the loop (1:40–2:15)

> "It escalated two cases. A model-flagged high-risk desk — the AI anchored the verdict so transfers
> to it already block, but the *freeze* decision comes to me. And a confirmed sanctions hit —
> auto-contained immediately, with fund recovery escalated for my approval."

Show: the **Protect review queue**; click **Approve** on the high-risk freeze.

> "The AI proposes; the human disposes. It never moves funds on its own."

## Beat 4 — Grow: the same pass finds opportunity (2:15–2:50)

> "Here's the part compliance tools don't do. The same sweep surfaced high-value prospects from
> public on-chain signals: a strategic account, a new applicant with large inbound capital —
> time-sensitive — and one that's valuable *but* risk-flagged, so onboard carefully. This is BD
> intelligence: it prioritizes legitimate outreach and routes leads to a human. It does not trade on
> or front-run anything."

Show: the **Growth opportunity inbox**; click **Flag for outreach** on the strategic prospect.

## Beat 5 — Proof + close (2:50–3:10)

> "Every account shows both dimensions — risk and opportunity — and every action is a real on-chain
> transaction with a full audit log, verifiable on the HashKey explorer."

Show: the monitored-accounts table (risk + opportunity) and the audit-trail log; click a tx hash.

> "accredit: the AI operations layer for regulated on-chain finance — protect *and* grow, human in
> the loop, live on HashKey."

---

## Recording notes
- For a clean first-run take, reset the cohort first: bottom of the console → **Demo controls → Reset
  cohort** (revokes + unfreezes so the sweep shows onboarding + auto-freeze again).
- The manual tools (**Manual interventions** / **Issuance operations**) are collapsed by default —
  expand briefly only if showing ad-hoc/manual capability.
- Keep the HashKey testnet explorer open in a second window for the tx-hash click.
- Money beats: Beat 2 (console fills) + Beat 3 (HITL approve) + Beat 4 (Grow — the differentiator).
- Run `ui/` with `pnpm dev` (port 3010); `.env.local` must hold the keys (gitignored).
