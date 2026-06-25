# accredit — the AI that runs compliance operations on HashKey

## The problem
HashKey is built for regulated, compliant finance — and the *primitives* are already here:
ERC-3643 permissioned tokens (Nexatoken/CaaS), AML intelligence (MistTrack and others support
HashKey), on-chain identity (ZKID). What still doesn't scale is the **operations**: human
compliance officers monitoring wallets, screening counterparties, deciding, acting, and logging —
manually. It's slow, expensive, and realistically *spot-checked*, not full-coverage.

## What accredit is
**Not another compliance primitive — the AI operator on top of them.** accredit automates the
compliance operating loop (monitor → screen → decide → act → log) with a **human-in-the-loop**,
turning the existing primitives into its tools.

One **compliance sweep**:
- Screens the entire participant set — **100% coverage**, not a spot-check.
- Auto-resolves the routine: onboards clean applicants, anchors every AML verdict on-chain.
- **Auto-contains** confirmed sanctions/list hits (freeze immediately).
- **Escalates** the judgment calls and every irreversible action to a human review queue
  (model-flagged high-risk freezes; fund recovery). The AI proposes; the human disposes.
- Produces a full **decision log** + on-chain audit trail.

## Why human-in-the-loop (and why that's the point)
In compliance, autonomy on the wrong action = liability (freezing a legitimate user, seizing
funds). accredit auto-handles the unambiguous toil and **escalates ambiguity and all value moves
to a human**. It makes the officer ~10× faster, not absent — which is exactly what a regulated
operator can actually adopt.

## Why on HashKey
HashKey’s regulated-VASP DNA (HK SFC alignment, RWA focus, KYC/AML at the token level) is precisely
where automated-but-accountable compliance operations matter. accredit composes with HashKey’s own
stack rather than competing: anchor verdicts on its tokens, plug best-in-class AML intel (e.g.
MistTrack) in as the risk oracle.

## What’s live (HashKey testnet, chainId 133)
- ERC-3643-style stack: IdentityRegistry, AmlOracle, ModularCompliance, CompliantToken (cHSP),
  CompliantWrapper — all deployed and verifiable on the explorer.
- A trained, explainable AML risk model (logistic regression) anchored on-chain via `attestRisk`.
- The **AI Compliance Operator**: one-click sweep with live metrics, decision log, and a
  human review queue — manual vs AI side by side.
- Demo metrics from a live run: 5 screened / 100% coverage / 3 auto-resolved / 2 escalated /
  ~1 minute vs ~15 minutes manual — every action a real on-chain tx.

## Honest scope
A working prototype of the operating-model shift, not a production compliance system. The AML
model is a hackathon-grade, explainable stand-in (designed to plug in MistTrack/Elliptic-grade
intel). Identity is per-address (full ONCHAINID/trusted-issuer is roadmap).

## The ask
The compliance *primitives* are commoditizing on HashKey. The durable layer is the **autonomous,
accountable operator** that runs them. accredit is that layer.
