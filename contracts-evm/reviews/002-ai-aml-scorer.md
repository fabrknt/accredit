# Review 002 — AI-AML risk scorer

**Reviewer: Claude Code (cross-pass).  Implementer: Codex.  Branch: `task/002-ai-aml-scorer`.**

## Verdict: APPROVE

Scope met, design followed exactly, gates re-verified independently, functional smoke passes.

## Gates (re-run by reviewer)
- `pnpm build` (tsc, strict + noUncheckedIndexedAccess + verbatimModuleSyntax): clean.
- `pnpm test` (vitest): 11/11 pass across `features.test.ts` (4) + `model.test.ts` (7).
- `forge test`: 13/13 (contracts untouched).
- Functional smoke (CLI dry-run): watchlisted `…dead` → 65 high; clean addr + sanctioned
  counterparty → 30 medium; clean addr → 5 low; `modelRef` stable across runs.
- No secrets committed; keys read from env only on the `--submit` path.

## What's good
- Weight design is clean: 60/25/10/5 sum to 100, so a fully-firing address maxes at
  exactly 100 and `sanctioned_direct` alone (60) already lands `high`. Matches the
  ModularCompliance `maxRiskScore=50` block threshold.
- Model + features are pure; chain I/O is correctly isolated behind `ChainReader`
  (injected) so the model is unit-tested without network. `attestRisk` ABI matches the
  contract (`address,uint8,bytes32`). Dry-run is the default; `--submit` is the only
  write path.
- Tests are meaningful, not trivial: banding boundaries (24/25, 49/50), clamps (0/100),
  per-feature firing, deterministic aggregation, and a pinned `modelRef` value.

## Findings (all P2, non-blocking)
- `clampUint8` in `chain.ts` duplicates `clampScore` in `model.ts`. Score is already
  clamped upstream, so this is defensive redundancy — could import `clampScore`.
- `src/globals.d.ts` hand-declares `console`/`process` to avoid `@types/node`.
  Functional, but `@types/node` as a devDep would be the standard fix and would type
  `process.env` properly. Deferred.
- Default `txCount=0` (no chain, no signals) makes `account_newness` contribute a
  baseline 5 (still `low`). Benign; documented here for awareness.

## Decision
Approved and merged to `master`. P2s logged; no change required for the Day-2 AI-AML goal.
The on-chain `--submit` run is deferred (needs SCORER_ROLE key + deployed AmlOracle).
