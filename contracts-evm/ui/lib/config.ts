// Server-side config. Addresses + chain are safe to read; keys are read ONLY inside
// API route handlers (never imported into client components). CC-provided stub —
// Codex extends with ABIs (lib/abis.ts) and viem clients (lib/chain.ts).
import { defineChain } from "viem";

export const RPC_URL = process.env.RPC_URL ?? "https://testnet.hsk.xyz";
export const CHAIN_ID = Number(process.env.CHAIN_ID ?? "133");
export const EXPLORER_BASE = process.env.EXPLORER_BASE ?? "https://testnet-explorer.hsk.xyz";

export const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Blockscout", url: EXPLORER_BASE } },
});

type Hex = `0x${string}`;
const addr = (v: string | undefined): Hex => (v ?? "0x0000000000000000000000000000000000000000") as Hex;

export const addresses = {
  registry: addr(process.env.REGISTRY),
  aml: addr(process.env.AML),
  compliance: addr(process.env.COMPLIANCE),
  token: addr(process.env.TOKEN),
  mockUsdc: addr(process.env.MOCKUSDC),
  wrapper: addr(process.env.WRAPPER),
} as const;

export const demo = {
  alice: addr(process.env.DEMO_ALICE),
  bob: addr(process.env.DEMO_BOB),
  // The watchlisted high-risk address used in the demo.
  dead: "0x000000000000000000000000000000000000dead" as Hex,
} as const;

export const explorerAddress = (a: string) => `${EXPLORER_BASE}/address/${a}`;
export const explorerTx = (h: string) => `${EXPLORER_BASE}/tx/${h}`;
