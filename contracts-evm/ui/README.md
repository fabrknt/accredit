# accredit — Compliance Console (UI)

Institutional compliance dashboard for the accredit stack on HashKey Chain testnet.
Next.js 14 (App Router) + Tailwind + viem. Reads live on-chain state; all writes go
through server-side API routes that sign with keys held only on the server.

## Sections
- **Header** — chain + the 6 deployed contract addresses (explorer links).
- **Identity & Risk** — live KYC verified / frozen / identity / AML score+band + cUSDC balance for Alice, Bob, the watchlisted address.
- **AI-AML Screening** — score any address (with optional counterparty), see the explainable per-feature breakdown, and anchor the verdict on-chain (`attestRisk`).
- **Payment Simulator** — `canTransfer` preview + real execute; Alice→Bob (allowed) vs Alice→flagged (blocked: "recipient failed AML screen").
- **Agent Console** — freeze / unfreeze (ERC-3643 agent power).
- **Compliant Wrapping** — wrap/unwrap MockUSDC ↔ cUSDC 1:1.

## Run

```bash
cp .env.local.example .env.local   # fill RPC, addresses, PRIVATE_KEY (agent), ALICE_KEY (demo payer)
pnpm install --ignore-workspace
pnpm dev      # http://localhost:3010   (or: pnpm build && pnpm start)
```

## Security model
- Signing keys (`PRIVATE_KEY`, `ALICE_KEY`) are read **only** inside `app/api/**` route
  handlers and `lib/server.ts` (never imported by a client component). The production
  client bundle contains no keys. `app/page.tsx` is a server component and reads
  `PRIVATE_KEY` only to derive the deployer's public address for display.
- Addresses are configured via env (`lib/config.ts`); `.env.local` is gitignored.

## Notes
- Write routes wait for the tx receipt and check `status` before reporting success, so
  rapid successive actions don't collide on nonce and the dashboard refresh shows
  settled state.
- The AML score is computed by the off-chain scorer in `../scorer` (invoked by
  `/api/score` and `/api/attest`).
