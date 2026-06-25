# Task 003 — CompliantWrapper (1:1 HSP → cHSP)

**Owner (implement): Codex.  Reviewer (cross-pass): Claude Code.**
**Branch:** `task/003-compliant-wrapper`

## Goal

Let holders wrap an existing stablecoin (HSP) 1:1 into the compliance-gated `cHSP`,
and unwrap back. This pulls existing liquidity into the compliance layer — the credible
"compliance-enforced HSP payments" story (and the HSP-bonus angle).

## Design (decided by CC — implement to this, do not redesign)

Three pieces. One is a small additive change to an existing contract; review carefully.

1. **`src/CompliantToken.sol` — add `burnFrom(address from, uint256 amount)`** (additive,
   do not change existing behaviour or break the 13 tests):
   - Spend the caller's ERC20 allowance from `from` (use OZ `_spendAllowance`).
   - Gate on `compliance.canRedeem(from, amount)` (same protection as self-`burn`: a
     frozen/sanctioned holder cannot unwrap out). Revert with the returned reason.
   - Then `_burn(from, amount)`.
   - Rationale: the wrapper needs to burn a user's cHSP on unwrap, with the user's
     consent expressed via allowance — NOT a privileged confiscation. No new role.

2. **`src/MockHSP.sol` — a plain test ERC20** standing in for the real HSP on testnet
   (the canonical HSP token address is still TBD). `ERC20("Mock HSP","HSP")` + an
   open/owner `mint(to,amount)` for demo funding. Clearly labelled as test-only.

3. **`src/CompliantWrapper.sol`:**
   - `constructor(IERC20 underlying, CompliantToken cToken)` — store both.
   - `wrap(uint256 amount)`: `underlying.transferFrom(msg.sender, address(this), amount)`
     then `cToken.mint(msg.sender, amount)`. Mint goes through `canReceive`, so a
     non-compliant depositor is rejected — that's intended. (Wrapper must hold
     `ISSUER_ROLE` on cToken; granted at deploy, see script.)
   - `unwrap(uint256 amount)`: `cToken.burnFrom(msg.sender, amount)` (caller must have
     approved the wrapper for cHSP) then `underlying.transfer(msg.sender, amount)`.
   - Emit `Wrapped(account, amount)` / `Unwrapped(account, amount)`.
   - 1:1 backing: underlying held by the wrapper always equals cHSP it has minted and
     not yet burned. Keep it simple — no fees, no rebasing.

4. **`script/DeployWrapper.s.sol`** — deploys `MockHSP` + `CompliantWrapper`, then grants
   the wrapper `ISSUER_ROLE` on the existing `CompliantToken` (reads `TOKEN` from env).
   Log all addresses. (Actual testnet broadcast is a later step — CC will run it.)

## Acceptance criteria

- `forge build` clean; `forge test` green — existing 13 still pass + new wrapper tests.
- New tests cover:
  - `wrap` mints cHSP 1:1 to a compliant user and locks the underlying.
  - `wrap` reverts for a non-compliant recipient ("recipient not KYC-verified" /
    "recipient failed AML screen").
  - `unwrap` burns cHSP and returns the underlying 1:1; requires allowance (reverts
    without it).
  - a frozen holder cannot `unwrap` ("account frozen").
  - 1:1 backing invariant holds after wrap+unwrap.
  - `burnFrom` spends allowance correctly and is `canRedeem`-gated.
- No secrets committed. Do not touch `IdentityRegistry`/`AmlOracle`/`ModularCompliance`
  or the scorer.

## Out of scope

- Actual testnet deploy/broadcast of the wrapper (CC runs it after review).
- Wiring to the real (non-mock) HSP token address.
- UI, fees, multi-asset wrapping.

## Handoff

Commit on the branch, gates green, request CC review → `reviews/003-compliant-wrapper.md`.
