# Review 003 — CompliantWrapper (1:1 HSP → cHSP)

**Reviewer: Claude Code (cross-pass).  Implementer: Codex.  Branch: `task/003-compliant-wrapper`.**

## Verdict: APPROVE

Spec followed exactly, gates re-verified, security-sensitive `burnFrom` is correct.

## Gates (re-run by reviewer)
- `forge build`: clean (pre-existing test lint warnings only).
- `forge test`: 22/22 (13 existing untouched + 9 new).
- No secrets; only `MockHSP`/`CompliantWrapper`/`burnFrom`/script added; registry/oracle/
  compliance/scorer untouched.

## What's good
- `burnFrom`: `_spendAllowance` → `canRedeem` gate → `_burn`. Consent via allowance (not
  privileged confiscation), and a frozen/sanctioned holder still can't unwrap out. The
  `canRedeem`-gated test proves it.
- Wrapper: `wrap` = `transferFrom` underlying → `mint` (so a non-compliant depositor is
  rejected by `canReceive` — both reject paths tested). `unwrap` = `burnFrom` (effect)
  before `underlying.transfer` (interaction) — correct CEI order. Constructor zero-addr
  checks. 1:1 backing invariant asserted (`underlying.balanceOf(wrapper) == totalSupply`).
- Tests are real and cover every acceptance criterion.

## Findings (all P2, non-blocking for hackathon with a trusted HSP)
- No `nonReentrant` guard. `unwrap` is CEI-safe; `wrap` calls `underlying.transferFrom`
  before `mint`, so a reentrant/hook-bearing underlying could re-enter. Standard ERC-20
  HSP has no hooks → fine now. Add `ReentrancyGuard` + `SafeERC20` before wiring a real
  or arbitrary underlying.
- Raw `transferFrom`/`transfer` with `require(success)` assumes a bool-returning ERC-20.
  Fine for HSP/MockHSP; `SafeERC20` would handle non-standard (USDT-style) tokens.

## Decision
Approved and merged to `master`. P2 hardening (ReentrancyGuard + SafeERC20) logged for
the production pass. Next: CC can deploy MockHSP + wrapper to testnet (DeployWrapper.s.sol)
to extend the live demo.
