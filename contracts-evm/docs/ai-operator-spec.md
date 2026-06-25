# AI Compliance Operator — spec (for sign-off before implementation)

## Premise
The compliance *primitives* already exist on HashKey (Nexatoken/ERC-3643 enforcement,
MistTrack-style AML intel, ZKID). What is still **human-operated** is the *operations*:
monitor → triage → screen → decide → act → log. accredit automates that operating layer
with a transparent, human-in-the-loop AI operator. Existing primitives become its tools.

## Two modes (the demo's core)
- **Manual** = today: the operator works each address by hand (the existing panels).
- **AI-Auto** = accredit agent: one "Run compliance sweep" processes everyone, auto-resolves
  routine, escalates the ambiguous/high-stakes to a human, logs every decision.

## The automation / escalation boundary (THE key decision — please confirm)

| Risk outcome | What the AI does | Why |
|---|---|---|
| **Clean (score <25)** | AUTO: refresh on-chain attestation; if a pending onboard with valid KYC → AUTO-approve onboarding; keep active | routine, low-stakes |
| **Watch (25–49)** | AUTO: anchor updated score on-chain; flag "watch"; no freeze | informational; transfers still allowed (gate threshold 50) |
| **High — model-driven (50–74, not a list hit)** | AUTO: anchor score on-chain (→ incoming transfers auto-block at the gate). **ESCALATE the freeze decision to a human** with rationale + recommendation | ambiguous judgment = human owns it; but the verdict is still anchored so the gate protects in the meantime |
| **Confirmed sanctions hit (direct watchlist/OFAC match ONLY)** | AUTO-contain: freeze immediately + anchor max score. **ESCALATE recovery (forcedTransfer) to a human** | a confirmed *list* hit is deterministic/unambiguous → auto-freeze defensible; moving funds is not |

> **Revision during build:** the auto-freeze trigger is **watchlist/list-hit ONLY** (dropped the
> earlier "or ≥75"). A high *model* score — even ≥75 — is still model judgment and can be a false
> positive, so it goes down the High path and **escalates the freeze** rather than auto-freezing.
> Only a deterministic list match auto-contains. This is the more defensible compliance stance.
| **Any irreversible value move (forcedTransfer / seizure)** | NEVER auto — always human-approved | irreversible, high liability |

**Principle:** AI does the toil + unambiguous containment + anchoring; **humans own ambiguous
judgment and all irreversible value moves.** AI makes the operator ~10× faster, not absent.

## The sweep loop (what one run does)
1. Enumerate the participant cohort + pending onboarding requests.
2. Re-screen each via the scorer → score/band/explainable breakdown.
3. Apply the policy table above → decide an action per item.
4. Execute AUTO actions on-chain (attest / onboard / freeze-if-sanctioned), each waited + status-checked.
5. Collect ESCALATIONS into a human review queue (address, score, rationale, recommendation).
6. Emit a **decision log** (per item: signals → band → policy → action → tx hash) + **metrics**.

## Metrics shown (before/after the toggle)
- Coverage: items screened (AI = 100% of cohort; manual = realistically a spot-check).
- Time: sweep seconds vs an explicit manual estimate (`N items × ~M min each`).
- Auto-resolved vs escalated counts.
- On-chain actions taken (attestations / onboards / freezes), each with a tx link.
- Full auditable decision log (every action has a rationale).

## Human-in-the-loop UI
An **escalation queue**: each AI-surfaced item shows score + rationale + AI recommendation +
**Approve / Reject** buttons that execute freeze / recovery via the existing routes. Makes HITL
concrete and visible — the AI proposes, the human disposes.

## Demo cohort (to make the delta pop)
~6–8 seeded participants with designed profiles: several clean, a couple watch-level, one
pending onboard (clean), one model-high (→ escalated), one confirmed-sanctions (→ auto-frozen).
Manual mode slogs through all; AI mode resolves the routine + auto-contains the sanctions hit +
escalates the one ambiguous case, in seconds, with a full log.

## Honesty / guardrails (stated in the demo)
- AI never moves funds autonomously; forcedTransfer is always human-approved.
- Only confirmed-sanctions auto-freeze; ambiguous high-risk escalates.
- Every action is logged with rationale + on-chain tx (auditable).
- This is a working prototype of the operating-model shift, not a production compliance system.

## Build footprint (after sign-off)
- Server `/api/sweep`: runs the loop over the cohort, returns `{decisionLog, metrics, escalations}`.
- A demo cohort config (addresses + signals driving scores).
- UI: a Manual/AI-Auto toggle; AI mode shows sweep progress → decision log + metrics + escalation
  queue (Approve/Reject wired to existing freeze / recovery).
- Demo script rewritten as "Manual vs AI" with the metrics as the punchline.
