# Task 002 — AI-AML risk scorer (off-chain → AmlOracle)

**Owner (implement): Codex.  Reviewer (cross-pass): Claude Code.**
**Branch:** `task/002-ai-aml-scorer`

## Goal

Build the off-chain AML risk scorer — the AI×DeFi half of the pitch. It computes an
explainable risk score (0–100) for an address and writes the verdict on-chain via
`AmlOracle.attestRisk(account, score, modelRef)`. On-chain anchors the verdict; this
scorer owns the richness and explainability.

## Design (already decided by CC — implement to this, do not redesign)

- **Location / stack:** `contracts-evm/scorer/`, TypeScript on Node 24, pnpm, `vitest`
  for tests, `viem` for chain I/O. CC has scaffolded `package.json`, `tsconfig.json`,
  installed deps, and stubbed `src/types.ts`. Implement the rest.
- **Model = transparent weighted-feature scorer (NOT an LLM).** AML needs reproducible,
  auditable, explainable scores. Each feature contributes a weighted sub-score; the
  total clamps to 0–100. Output includes the per-feature breakdown (which features
  fired and how much). This is the honest "AI/ML risk scoring" framing; an LLM
  narrative layer is explicitly out of scope / roadmap.
- **`modelRef`** (the on-chain `bytes32`) = `keccak256("accredit-aml/<modelId>@<version>")`,
  computed deterministically so the exact model+weights are auditable from chain. Use
  viem's `keccak256`/`toBytes`.
- **Score → AmlOracle contract:** score is `uint8` 0–100; clamp before submit. Band:
  0–24 low, 25–49 medium, 50–100 high (note: `ModularCompliance` default `maxRiskScore`
  = 50, so >=50 is blocked).

## Scope (build these in `src/`)

1. **`features.ts`** — pluggable feature extractors, each `(ctx) => { id, weight, score, reason }`:
   - `sanctioned_direct`: address ∈ flagged watchlist → max contribution.
   - `sanctioned_exposure`: address's provided counterparties intersect the watchlist
     (1-hop) → high contribution.
   - `velocity`: tx count in window above a threshold → low/medium.
   - `account_newness`: very low tx count / freshly seen → low/medium.
   Features read from the `ScoringContext` (below); on-chain reads (tx count, code
   presence) come via an injected `ChainReader` so the model stays unit-testable
   without network.
2. **`model.ts`** — `score(ctx): RiskResult` = combine feature outputs → clamped 0–100
   total + band + `reasons[]` + `modelRef`. Deterministic.
3. **`chain.ts`** — a `viem`-backed `ChainReader` (txCount via `getTransactionCount`,
   code presence via `getCode`) + a `submitAttestation(...)` that calls
   `AmlOracle.attestRisk` with a wallet client. Network/keys only used here.
4. **`watchlist.json`** — a small demo list of flagged addresses (clearly demo data).
5. **`cli.ts`** — `score <address>`: compute + print the explanation table (dry-run,
   default). `--submit`: also send `attestRisk` (requires env `RPC_URL`,
   `AML_ORACLE_ADDRESS`, `SCORER_PRIVATE_KEY`). Default is dry-run; never submit
   without `--submit`.
6. **`src/types.ts`** — extend the CC stub (ScoringContext, Feature, RiskResult, etc.).

## Acceptance criteria

- `pnpm build` (tsc) clean; `pnpm test` (vitest) green.
- Model unit tests cover: each feature firing, banding boundaries (24/25, 49/50),
  score clamps at 0 and 100, `modelRef` is a stable 32-byte hash, a watchlisted
  address scores `high` (>=50), a clean address scores `low`.
- Model + features are pure (no network in tests); chain I/O isolated behind
  `ChainReader` and only exercised by the CLI/submit path.
- No secrets committed. Keys read from env at runtime only.
- `forge test` still 13/13 (you are not touching contracts, but confirm nothing broke).

## Out of scope (do NOT do here)

- Real ML training / datasets / LLM narrative layer.
- Graph clustering beyond the provided 1-hop counterparties.
- The actual on-chain submit run (needs SCORER_ROLE key + deployed AmlOracle = later).
- Mainnet, UI, CompliantWrapper.

## Handoff

Commit on the branch, ensure gates hold, request CC review → `reviews/002-ai-aml-scorer.md`.
