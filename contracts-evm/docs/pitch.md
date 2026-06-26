# accredit — the AI operations layer for regulated on-chain finance

## The problem
HashKey is built for regulated, compliant finance, and the *primitives* are already here: ERC-3643
permissioned tokens (Nexatoken/CaaS), AML intelligence (MistTrack and others support HashKey),
on-chain identity (ZKID). What still doesn't scale is the **operations** — humans monitoring,
screening, deciding, acting, logging — and that work today is **purely defensive**. It's slow,
expensive, spot-checked, and it never grows the business.

## What accredit is
**Not another compliance primitive — the AI operator on top of them**, running the operating loop
with a **human in the loop**. One sweep does two jobs:

- **Protect** — screens every account (100% coverage), auto-onboards the clean, anchors AML verdicts
  on-chain, **auto-contains** confirmed sanctions, and **escalates** judgment calls + irreversible
  actions to a human review queue. The AI proposes; the human disposes; it never moves funds itself.
- **Grow** — on the same pass, surfaces **high-value prospects and intent signals** (strategic
  accounts, large inbound capital, etc.) for the BD / onboarding team, with a recommended action.
  Advisory only: it prioritizes legitimate outreach and routes leads to a human — it does **not**
  trade on or front-run anything.

The console starts on standby; one **Run sweep now** populates everything — KPIs, the protect review
queue, the growth opportunity inbox, the monitored-accounts table (risk + opportunity), and a full
on-chain audit log.

## Why this wins (cost-center → also profit-center)
Compliance is a cost center; every other tool automates *only* defense. accredit is the first to make
the **same AI pass keep you compliant AND grow your book** — far more compelling to an exchange/chain
chasing institutional volume, and a category no compliance tool occupies. It composes with HashKey's
own stack (anchor verdicts on its tokens; plug best-in-class AML intel like MistTrack in as the
oracle) rather than competing with it.

## Why human-in-the-loop
In compliance, autonomy on the wrong action = liability. accredit auto-handles the unambiguous toil
and **escalates ambiguity and all irreversible/value moves to a human** — making the officer ~10×
faster, not absent. That's what a regulated operator can actually adopt.

## What's live (HashKey testnet, chainId 133)
- ERC-3643-style stack deployed + verifiable: IdentityRegistry, AmlOracle, ModularCompliance,
  CompliantToken (cHSP), CompliantWrapper.
- A trained, explainable AML risk model + a transparent opportunity model, both anchored/auditable.
- The **AI operations console**: one sweep → protect (queue) + grow (inbox) + accounts + audit log.
- Live sweep: 5 screened / 100% coverage / auto-resolved + escalated + prospects surfaced in ~1 min
  vs ~15 min manual — every action a real on-chain tx.

## Honest scope
A working prototype of the operating-model shift, not a production system. The AML model is a
hackathon-grade, explainable stand-in (designed to plug in MistTrack/Elliptic-grade intel); the
growth signals are partly demo-seeded (testnet has thin real history); identity is per-address
(full ONCHAINID/trusted-issuer is roadmap); the wrapper uses a MockHSP stand-in.

## The ask
The compliance *primitives* are commoditizing on HashKey. The durable layer is the **autonomous,
accountable operator** that runs them — and now also grows the book. accredit is that layer.
