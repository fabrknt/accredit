# Task 005 — Upgrade AI-AML scorer to a trained ML model

**Owner (implement): Codex.  Reviewer (cross-pass): Claude Code.**
**Branch:** `task/005-ml-scorer`

## Goal

Close the "AI is thin" gap for the AI track: replace the hand-weighted sum with a
**logistic-regression risk model trained on a labeled dataset**. Trained (not hand-tuned)
weights, fully explainable, dependency-light, and auditable (model hashed on-chain).
Keep the public interface and on-chain integration unchanged.

## Design (decided by CC — implement to this)

All inside `scorer/` (deps already installed; this is pure TS, add no heavy runtime deps).

1. **Feature vector** — keep the existing extractors and ADD a few so the model has real
   signal: `sanctioned_exposure_ratio` (matched counterparties / total), `counterparty_count`,
   plus the existing velocity / account_newness. Keep `sanctioned_direct` but treat it as a
   **hard override** (a directly-watchlisted/OFAC address ⇒ score 100, bypass the model — a
   direct sanctions hit is a block, not a probability). The model handles the gradient cases.

2. **Training** — `scorer/src/train.ts` (run via tsx): batch gradient-descent logistic
   regression on `scorer/data/training.json` (a checked-in labeled dataset, see #4).
   Standardize features (store mean/std). Output `scorer/src/model.json`:
   `{ version, featureNames[], mean[], std[], weights[], bias, threshold }`. Deterministic
   (fixed init, fixed iterations — no Math.random; seed any shuffles deterministically).

3. **Inference** — `model.ts` loads `model.json`, standardizes the feature vector, computes
   `p = sigmoid(w·x + b)`, maps to `score = round(100*p)`. Bands unchanged (≥50 high / ≥25
   medium). Per-feature contribution for explainability = standardized_feature_i * weight_i
   (sign-aware), surfaced in `breakdown[]`/`reasons[]`. `modelRef` = `keccak256` of the
   canonical (stably-stringified) `model.json` contents — so the exact trained model is
   auditable from chain. Keep `RiskResult` and the CLI/`attestRisk` path unchanged.

4. **Dataset** — `scorer/data/training.json`: a checked-in, labeled dataset (a few hundred
   rows) of `{features, label}` where label 1 = illicit, 0 = benign. Synthesize it
   deterministically from documented, realistic distributions (illicit: higher sanctioned
   exposure, bursty velocity, fresh accounts; benign: the opposite, with overlap so it's not
   trivially separable). Add a header/README note that this is a **representative curated
   dataset for the hackathon**, not production ground truth — be honest about that.

## Acceptance criteria

- `pnpm build` clean; `pnpm test` green. `npx tsx src/train.ts` (or `pnpm train`) regenerates
  `model.json` deterministically (same output on re-run).
- Tests: model.json loads; a clearly-illicit feature vector scores high (≥50) and a clearly-
  benign one scores low (<25); `sanctioned_direct` override forces 100; score clamped 0–100;
  `modelRef` is a stable 32-byte hash of model.json; trained accuracy on a held-out slice is
  reported (sanity, e.g. >0.8) in a test or train log.
- Interface unchanged: `score(ctx)` still returns `RiskResult`; CLI `--submit` still calls
  `AmlOracle.attestRisk`; on-chain contracts untouched.
- No secrets; no network needed for train/test.

## Out of scope
- LLM narrative layer (possible later stretch), real on-chain historical feature backfill,
  external datasets/downloads, changing any Solidity.

## Handoff
Commit on the branch, gates green, request CC review → `reviews/005-ml-scorer.md`.
