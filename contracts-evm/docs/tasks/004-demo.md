# Task 004 — Live demo execution script

**Owner (implement): Codex.  Reviewer (cross-pass): Claude Code.**
**Branch:** `task/004-demo`

## Goal

Build `demo/run-demo.sh` — a single runnable script that performs the demo beats in
`docs/demo-script.md` LIVE against the HashKey testnet deployment, printing clean,
recordable output. CC owns the narration (`docs/demo-script.md`); you own the executable.

## Context (already in place)

- Live deployment + addresses: `docs/deployment-testnet.md`; all values are in `.env`
  (gitignored): `PRIVATE_KEY` (deployer, has gas + AGENT/ISSUER/SCORER roles),
  `REGISTRY`, `AML`, `COMPLIANCE`, `TOKEN`, `MOCKHSP`, `WRAPPER`, `DEMO_ALICE`,
  `DEMO_BOB`, `ALICE_KEY`, `BOB_KEY`. RPC `https://testnet.hsk.xyz`, explorer
  `https://testnet-explorer.hsk.xyz`.
- Foundry `cast` is available. The AI-AML scorer runs via `(cd scorer && pnpm -s score
  score <addr> [--submit])` with env `RPC_URL`, `AML_ORACLE_ADDRESS`, `SCORER_PRIVATE_KEY`.

## Scope — `demo/run-demo.sh` (bash)

Implement the 6 beats from `docs/demo-script.md`, each with a clear header:

0. **Stack** — print the 6 contract addresses + their explorer URLs.
1. **Onboard** — `cast call` `isVerified(alice,1)`, `isClean(alice,50,2592000)`,
   `balanceOf(alice)`.
2. **Compliant payment** — ensure Alice has a little gas (if her HSK balance is low, send
   a small amount from the deployer); then send a REAL tx `alice → bob` of 50 cHSP signed
   with `ALICE_KEY`; show Bob's cHSP balance before/after and the tx hash.
3. **AI-AML scorer** — run the scorer on `0x…dead` with `--submit`; print score/band/
   breakdown; read back `riskOf(dead)` from chain.
4. **Blocked transfer** — ensure `dead` is KYC-registered (register via deployer if not,
   so AML is the blocker, not KYC); attempt a REAL tx `alice → dead`; it MUST revert —
   capture it gracefully and surface the revert reason (use `cast call ... --from alice`
   to print `recipient failed AML screen`). Do NOT let the failure abort the script.
5. **Wrap/unwrap** — using the deployer (already compliant): `wrap(300e18)` then
   `unwrap(100e18)` MockHSP↔cHSP; print balances showing 1:1 backing.

## Requirements

- Source `.env`; NO hardcoded addresses/keys. Never echo a private key.
- Interactive by default: pause between beats ("Press Enter…"). Support a non-interactive
  mode (`NONINTERACTIVE=1` or `--no-pause`) that runs straight through — used for review/CI.
- Idempotent/re-runnable: register-if-needed, fund-if-needed; don't crash on a second run.
- Robust amounts via `cast` (e.g. `$(cast to-wei 50)` or explicit 50e18 constants).
- Beat 4's expected revert must be handled (script exits 0 overall in --no-pause mode).
- Add a short `demo/README.md` (how to run, prerequisites, --no-pause).

## Acceptance criteria

- `NONINTERACTIVE=1 bash demo/run-demo.sh` runs all 6 beats end-to-end against live
  testnet, exits 0, and clearly shows: alice→bob SUCCESS, alice→dead BLOCKED with
  "recipient failed AML screen", and wrap/unwrap 1:1 balances.
- No private key printed to stdout.
- `forge build`/`forge test` unaffected (this is tooling).

## Out of scope
- Recording the actual video; UI; mainnet; changing any contract or the scorer logic.

## Handoff
Commit on the branch, run it once in `--no-pause` to confirm, request CC review →
`reviews/004-demo.md`.
