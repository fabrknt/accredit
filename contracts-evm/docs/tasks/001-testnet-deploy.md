# Task 001 — HashKey testnet deploy tooling + demo bootstrap

**Owner (implement): Codex.  Reviewer (cross-pass): Claude Code.**
**Branch:** `task/001-testnet-deploy`

## Goal

Make the compliance stack deployable to HashKey Chain testnet with one command, and
seed it into a demoable state, WITHOUT any secret committed. The human (Hiro) supplies
a funded key + faucet and runs the broadcast; everything else is tooling.

## Context (already verified, do not re-derive)

- HashKey **testnet**: chainId `133` (0x85), RPC `https://testnet.hsk.xyz`,
  explorer `https://testnet-explorer.hsk.xyz`, gas token HSK, faucet via docs.
- `foundry.toml` already defines rpc endpoints `hashkey_testnet` / `hashkey_mainnet`.
- Contracts in `src/`: IdentityRegistry, AmlOracle, ModularCompliance, CompliantToken.
- `script/Deploy.s.sol` already deploys all four (reads `PRIVATE_KEY` env).

## Scope (what to build)

1. **`.env.example`** — documented vars: `PRIVATE_KEY=`, `HASHKEY_EXPLORER_KEY=`
   (optional, for verification). Make clear `.env` is gitignored.
2. **`script/Bootstrap.s.sol`** — a post-deploy seeding script that, given the four
   deployed addresses (via env vars, e.g. `REGISTRY`, `AML`, `TOKEN`), puts the system
   into a demo-ready state:
   - registers two demo identities (KYC level 2, jurisdiction 392 = Japan, no expiry),
   - attests them AML-clean (low score) with a `modelRef`,
   - mints demo cHSP supply to the first demo address.
   Use clearly-labelled demo addresses derived from env (`DEMO_ALICE`, `DEMO_BOB`).
3. **`docs/runbook-testnet.md`** — exact step-by-step the human runs: get HSK from
   faucet → `forge script Deploy --rpc-url hashkey_testnet --broadcast` → capture the
   4 addresses → export them → run `Bootstrap` → verify on explorer.
4. **`script/verify.sh`** (or cast commands in the runbook) — post-deploy sanity:
   read `token.name()`, `token.symbol()`, `registry.isVerified(DEMO_ALICE,1)`,
   `aml.isClean(DEMO_ALICE,50,30 days)` via `cast call` against the testnet RPC.

## Acceptance criteria

- `forge build` clean; existing `forge test` still green (13/13).
- New scripts compile (`forge build` includes script/).
- No private key or `.env` committed; `.env.example` present and documented.
- Runbook is copy-pasteable and references the real RPC/explorer/chainId above.
- `Bootstrap.s.sol` is idempotent-safe to read (no hard-coded mainnet addresses).

## Out of scope (do NOT do here)

- The actual broadcast / spending real testnet HSK (human step).
- CompliantWrapper, AI-AML off-chain scorer service, UI — separate tasks.
- Pushing to the public GitHub remote.

## Handoff

When done: commit on the branch, ensure gates hold, then request CC review. CC writes
`reviews/001-testnet-deploy.md`.
