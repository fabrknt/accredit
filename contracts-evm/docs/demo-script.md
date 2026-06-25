# accredit on HashKey Chain — demo script (台本)

Target length **~3 min**. Narration in English (deliverable bilingually if asked).
Everything runs **live on HashKey Chain testnet (chainId 133)**. The companion executable
`demo/run-demo.sh` performs each beat and prints recordable output; this file is the
narration + what the audience should see.

**One-line pitch:** *accredit turns any stablecoin payment on HashKey into a
compliance-enforced one — KYC/allowlist transfer rules plus AI-driven AML screening,
enforced on-chain.*

---

## Beat 0 — The stack is live (0:00–0:25)

> "This is accredit, running live on HashKey Chain testnet. Four contracts: an identity
> registry for KYC, an AML oracle, a modular compliance engine, and cHSP — a
> compliance-gated stablecoin. All verifiable on the HashKey explorer."

Show: the 6 deployed addresses + explorer links (`docs/deployment-testnet.md`).

## Beat 1 — Onboard real users (0:25–0:50)

> "Alice and Bob are onboarded: KYC level 2, Japan jurisdiction, and screened
> AML-clean. The registry and oracle confirm this on-chain."

Show: `isVerified(alice,1)=true`, `isClean(alice,50,30d)=true`, Alice holds 1000 cHSP.

## Beat 2 — A compliant payment goes through (0:50–1:15)

> "Alice pays Bob in cHSP. Both are compliant, so the transfer settles — a normal
> stablecoin payment, but every transfer is checked at the contract level."

Show: live tx `alice → bob` (50 cHSP) succeeds; Bob's balance increases. Tx hash on explorer.

## Beat 3 — The AI-AML scorer flags a bad actor (1:15–1:50)

> "Now the AI side. Our off-chain AML scorer evaluates an address against sanctions
> exposure, velocity, and account signals — producing an explainable 0–100 score, with
> the model version hashed on-chain for audit. This address scores 65 — high risk. The
> verdict is written to the AML oracle."

Show: `demo` runs the scorer on `0x…dead` → score 65 / band high / per-feature breakdown
→ `attestRisk` tx. Then `riskOf(dead)` read back from chain.

## Beat 4 — Compliance blocks the flagged transfer (1:50–2:25)

> "Alice now tries to pay that same flagged address. Even though it's KYC'd, the
> compliance engine reads the AI verdict and blocks the transfer on-chain — reason:
> recipient failed AML screen. This is the whole pitch in one transaction: AI screening,
> enforced by the contract."

Show: live tx `alice → dead` **reverts** with `recipient failed AML screen`. Contrast with
Beat 2's success.

## Beat 5 — Pull existing liquidity into compliance (2:25–2:55)

> "Finally — adoption. Existing HSP holders wrap 1:1 into cHSP. The wrap only succeeds for
> compliant holders, so liquidity flows into the compliance layer; unwrapping returns the
> underlying. A frozen or sanctioned holder can't wrap in or unwrap out."

Show: `wrap(300)` → 300 cHSP minted, 300 HSP locked 1:1; `unwrap(100)` → returns underlying.
(Optional) freeze → wrap/unwrap blocked.

## Close (2:55–3:00)

> "accredit: compliance-enforced payments and AI-AML screening, live on HashKey Chain.
> Built for a regulated chain's regulated future."

---

## Recording notes
- Run `demo/run-demo.sh` once end-to-end first to seed/confirm state, then record a clean run.
- The script pauses between beats (resume on keypress) so narration can land.
- Keep the explorer open in a second window to click through tx hashes live.
- Beats 2 and 4 are the money shots — a real successful tx vs a real reverted tx, same sender.
