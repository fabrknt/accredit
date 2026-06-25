# UI narrative (confirmed 2026-06-25)

The dashboard must read as a story, not a console. On-screen copy below (English; judges
are international). Implemented as a scenario header + a clickable 5-step strip + per-section
"why" subtitles.

## Scenario header
- Title: **accredit — Compliance, enforced.**
- Sub: *A regulated stablecoin (cHSP) on HashKey Chain. KYC + AI-AML compliance, enforced on-chain — live.*
- Badge: HashKey Testnet · chainId 133

## Guided steps (numbered strip; click → scroll to section + highlight)
1. **Onboard verified users** — Only KYC-verified, AML-screened wallets can hold or receive cHSP. → `sec-identity`
2. **A compliant payment** — A normal stablecoin transfer — but every move is checked at the contract. → `sec-payment`
3. **AI flags a bad actor** — An AI-AML model scores risk off-chain and anchors the verdict on-chain. → `sec-aml`
4. **Enforcement blocks it** — The on-chain verdict blocks the payment — automatically. → `sec-payment`
5. **Control & adoption** — Freeze/recover compromised funds; wrap existing HSP into compliance 1:1. → `sec-agent`

## Section "why" subtitles
- Identity & Risk → *Who may hold cHSP — and their live AML risk.*
- AI-AML Screening → *The AI that decides: explainable, and anchored on-chain.*
- Payment Simulator → *Compliance enforced at the moment of transfer.*
- Agent Console → *Regulator-grade controls: freeze and recover.*
- Compliant Wrapping → *Pull existing HSP liquidity into the compliance layer, 1:1.*

## Page order (top→bottom follows the story)
Header → Steps → Holdings → Identity(1) → Payment(2,4) → AML(3) → Agent+Wrap(5)
