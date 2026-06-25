# Review 007 — UI narrative layer

**Branch: `task/007-ui-story`. Story design + impl: CC. Reviewer: Codex read-only cross-pass.**

## Why
Owner feedback: the dashboard read as an operator console — without a story you can't tell how
the pieces connect, and that is NOT self-evident to judges either (they grasp concepts but not
*your* flow from a grid of controls). Fix: make the UI self-narrating.

## What was added (story confirmed by Hiro before implementation — docs/ui-story.md)
- Scenario header: "accredit — Compliance, enforced." + one-line framing.
- `components/StorySteps.tsx`: a clickable 5-step strip (Onboard → Compliant payment → AI flags →
  Enforcement blocks → Control & adoption); clicking scrolls to the section and briefly ring-highlights it.
- Section anchors `sec-identity/sec-payment/sec-aml/sec-agent` + page reordered to follow the story.
- One-line "why this matters" subtitle on each section.

## Verification (CC)
- `pnpm build` clean (TS strict). Live render check: scenario header, story strip, all 4 section
  anchors, and the "why" subtitles all present in served HTML.

## Codex cross-pass (read-only): APPROVE — no P0/P1
- StorySteps targets match the page anchors (incl. the intentional duplicate sec-payment for step 4).
- Client/server boundary clean ("use client", document/window only inside the click handler).
- No React/TS bug.

## Decision
Approved and merged to `master`. The dashboard now tells the story end-to-end without narration.
