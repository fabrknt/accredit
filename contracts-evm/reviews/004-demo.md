# Review 004 — live demo execution script

**Reviewer: Claude Code (cross-pass).  Implementer: Codex.  Branch: `task/004-demo`.**

## Verdict: APPROVE (after 3 fixes during review)

`demo/run-demo.sh` was verified by running it **live against HashKey testnet** end-to-end.
All six beats execute and produce the intended outcomes. Codex (who has no network in its
sandbox) implemented; CC ran it live and drove the fix loop.

## Live run result (NONINTERACTIVE=1)
- Beat 0: 6 addresses + explorer links.
- Beat 1: `isVerified(alice,1)=true`, `isClean=true`, balance 1000 cHSP.
- Beat 2: real tx **alice → bob 50 cHSP succeeds** (Alice 1000→950, Bob +50); clean tx hash + explorer URL.
- Beat 3: scorer → score 65 / high / breakdown; `attestRisk` submitted; `riskOf(dead)` read back.
- Beat 4: real tx **alice → dead reverts** with `recipient failed AML screen` (shown via both
  the failed `cast send` and the `cast call --from alice` probe); script stays alive.
- Beat 5: **wrap 300 / unwrap 100**, 1:1 backing shown; clean wrap/unwrap tx hashes.

## Fixes applied during review
1. **bash 3.2 portability (CC):** line ~288 used bash-4-only `${VAR,,}` lowercase expansion,
   which aborts on macOS bash 3.2. Replaced with a `tr 'A-Z' 'a-z'` compare.
2. **cast bracket suffix (Codex):** `cast call …(uint256)` prints `1000… [1e21]`; the balance/
   allowance helpers passed the `[1e21]` into `cast from-wei` and errored. Fixed by `awk '{print $1}'`.
3. **tx-hash extraction (CC):** `cast send` returns a compact-JSON receipt; `extract_tx_hash`
   printed the whole blob (and the explorer URL was garbage). Now greps the `"transactionHash"`
   field specifically, with a table-format fallback. (Codex's background attempt stalled with no
   output; CC stopped it and applied the fix to keep moving.)

## Notes (non-blocking)
- Script is idempotent but cumulative across runs (balances grow); the per-beat "Net effect"
  message stays accurate. For recording, run once on a fresh-ish state.
- `docs/demo-script.md` (the narration / 台本, CC-authored) pairs with this script beat-for-beat.

## Decision
Approved and merged to `master`. The demo is recording-ready.
