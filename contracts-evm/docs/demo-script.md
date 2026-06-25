# accredit — demo script (台本): Manual vs AI

Target **~3 min**. English narration (judges are international). Everything runs **live on
HashKey Chain testnet (chainId 133)** in the dashboard (`ui/`, http://localhost:3010). The
punchline is the **Manual vs AI** contrast and the **metrics + audit log**.

**One-line pitch:** *accredit is the AI that runs your compliance operations on HashKey —
screening, onboarding, and sanctions containment automatically, escalating only the calls a
human must make. Not another compliance primitive; the operator on top of them.*

---

## Beat 0 — The real bottleneck (0:00–0:30)

> "On a regulated chain like HashKey, the compliance *primitives* already exist — KYC, AML
> screening, transfer enforcement. What doesn't scale is the **operations**: a human officer
> monitoring every wallet, screening, deciding, acting — slow, costly, and never full coverage.
> accredit automates that operating layer, and keeps a human in the loop for the calls that matter."

Show: the dashboard header + the operator console (live on HashKey testnet).

## Beat 1 — The manual reality (0:30–1:05)

> "This is the compliance operator's console. Done by hand, the officer works one wallet at a
> time — open it, screen it, decide, act, log it. For a handful that's minutes; at scale it's a
> backlog, so teams spot-check instead of covering everyone."

Show: scroll to **Screen & decide**, screen one address manually (Run scorer → breakdown). Then
**Transfer Policy**: click "Alice → flagged" → BLOCKED. "Enforcement works — but a human still has
to drive every step."

## Beat 2 — One AI sweep (1:05–1:55)

> "Now the AI operator. One sweep."

Show: top **AI Compliance Operator** → **Run compliance sweep**. While it runs (~1 min):

> "It screens the entire cohort — 100% coverage — re-scores everyone, and acts: clean applicants
> auto-onboarded, every verdict anchored on-chain."

Show the metrics fill in:

> "Five screened, full coverage, three auto-resolved, in under a minute — versus roughly fifteen
> minutes by hand, and only if you check everyone, which teams don't."

## Beat 3 — Human-in-the-loop (1:55–2:35)

> "Crucially, it doesn't pretend to replace judgment. It escalated two cases. A model-flagged
> high-risk desk — the AI anchored the verdict, so transfers to it already block, but the *freeze*
> decision comes to me. And a confirmed sanctions hit — auto-contained, frozen immediately, with
> fund recovery escalated for my approval."

Show: the **Human review queue**; click **Approve** on the high-risk freeze.

> "The AI proposes; the human disposes. It never moves funds on its own."

## Beat 4 — Proof + close (2:35–3:05)

> "Every action is a real on-chain transaction with a full decision log — verifiable on the
> HashKey explorer."

Show: click a tx hash in the decision log → explorer.

> "accredit doesn't reinvent compliance primitives — HashKey already has them. It automates the
> human operations on top, with a regulator-grade human-in-the-loop. Compliance operations, an
> order of magnitude faster — live on HashKey."

---

## Recording notes
- The **first** sweep is the best take: it shows onboarding + auto-freeze. To re-record a clean
  first-run, reset the cohort state first (revoke + unfreeze), e.g. from `contracts-evm/`:
  ```bash
  set -a && . ./.env && set +a; RPC=https://testnet.hsk.xyz
  for a in 0x00000000000000000000000000000000c0ffee10 0x00000000000000000000000000000000c0ffee11 \
           0x00000000000000000000000000000000c0ffee12 0x00000000000000000000000000000000c0ffee14 \
           0x000000000000000000000000000000000000dead; do
    cast send $REGISTRY "revokeIdentity(address)" $a --rpc-url $RPC --private-key $PRIVATE_KEY >/dev/null
    cast send $REGISTRY "setAddressFrozen(address,bool)" $a false --rpc-url $RPC --private-key $PRIVATE_KEY >/dev/null
  done
  ```
  (CC can add a one-click "Reset demo" button if preferred.)
- Keep the HashKey testnet explorer open in a second window to click tx hashes live.
- Beats 2–3 are the money shots: the metrics delta + the HITL approve.
- Run `ui/` with `pnpm dev` (port 3010); ensure `.env.local` has the keys (gitignored).
