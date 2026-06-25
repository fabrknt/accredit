# Review 001 — testnet deploy tooling

**Reviewer: Claude Code (cross-pass).  Implementer: Codex.  Branch: `task/001-testnet-deploy`.**

## Verdict: APPROVE

Scope met exactly, gates verified independently by the reviewer.

## Gates (re-run by reviewer, not trusted from implementer)
- `forge build`: clean (only the pre-existing `erc20-unchecked-transfer` lint in tests).
- `forge test`: 13/13 pass.
- `bash -n script/verify.sh`: syntax OK.
- No secrets committed; `.env` gitignored, only `.env.example` present.
- `src/` contracts and existing tests untouched.

## What's good
- `Bootstrap.s.sol` is idempotent beyond the brief: checks existing identity / risk /
  balance before writing and mints only the missing delta. Ordering is correct —
  identity + AML are seeded before mint, so `mint`'s `canReceive` gate passes.
- Runbook is copy-pasteable, uses the verified RPC/chainId/explorer, and includes a
  correct `forge verify-contract` recipe with properly ABI-encoded constructor args
  for `ModularCompliance(address,address,address)` and `CompliantToken(string,string,address,address)`.

## Findings
- **P2 (non-blocking):** `_attestRiskIfNeeded` treats an attestation as "ok" on
  `score + modelRef` match but ignores staleness. If Bootstrap is re-run >30 days
  later, it skips re-attesting and `isClean(...,30 days)` would then read false. Fine
  for a fresh demo run; worth a re-attest-if-stale check if the demo env is long-lived.
  Deferred — not fixing now.

## Decision
Approved and merged to `master`. P2 logged for later; no code change required for the
Day-2 deploy goal.
