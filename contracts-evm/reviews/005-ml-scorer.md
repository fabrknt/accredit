# Review 005 — ML AI-AML scorer

**Reviewer: Claude Code (cross-pass).  Implementer: Codex.  Branch: `task/005-ml-scorer`.**

## Verdict: APPROVE (after 1 fix during review)

The scorer is now a genuinely trained model, not hand weights. Gates re-verified in our
env (Node 24), functional smoke sensible.

## Gates (re-run by reviewer)
- `pnpm build`: clean. `pnpm test`: 14/14 (features 5 + model 9).
- `pnpm train`: regenerates `src/model.json` deterministically — identical SHA-256 across
  runs (`d80089…`); held-out accuracy 70/72 = **0.9722**.
- No `Math.random`/`Date.now` in train/model → deterministic. Dataset: 360 rows (140
  illicit / 220 benign).
- Functional smoke (CLI): watchlisted `…dead` → 100 (hard override); clean → 17 (low);
  clean + 1 sanctioned counterparty → 100 (high). `modelRef` = keccak256 of model.json
  (`0xe57b6e10…`), stable.
- Interface unchanged: `score()` → `RiskResult`; `--submit` → `attestRisk`; contracts untouched.

## What's good
- Real logistic-regression pipeline: 360-row labeled dataset → deterministic gradient-descent
  trainer → exported `model.json` (mean/std/weights/bias) → standardized sigmoid inference.
  Explainable (sign-aware per-feature contributions), auditable (model hashed on-chain).
- `sanctioned_direct` correctly kept as a hard 100 override (a direct OFAC hit is a block,
  not a probability). Added features (exposure ratio, counterparty count) give the model signal.

## Findings
- **P1 (fixed by CC):** `package.json` `train` script was `node --loader tsx …`, which fails
  on Node 24 (`--loader` removed/changed) — `pnpm train` errored. Changed to `tsx src/train.ts`
  (works, deterministic). Codex had set the loader form for its Node-18 sandbox.
- **P2 (non-blocking):** model is aggressive — a single sanctioned counterparty drives score to
  100. Defensible for AML (direct sanctioned exposure = high risk), but a richer/softer dataset
  would give more gradient. Fine for the demo.
- **P2 (doc):** `modelRef` changed from the old hand-weighted hash; `docs/deployment-testnet.md`
  cites the old value in a sample. Re-running the demo/scorer will write the new modelRef on-chain;
  update the doc when we re-record.

## Decision
Approved and merged to `master`. Closes the "AI is thin" gap for the AI track.
