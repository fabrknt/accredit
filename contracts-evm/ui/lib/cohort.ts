// Demo cohort the AI operator sweeps over. Addresses are deterministic demo wallets;
// `signals`/`counterparties` drive the scorer to a designed spread of risk bands.
// `pendingOnboard: true` means "not yet KYC-registered" (the sweep should onboard it).
import type { Address } from "viem";
import type { GrowthSignals } from "./opportunity";

export interface CohortMember {
  label: string;
  address: Address;
  counterparties?: Address[];
  signals?: { txCount?: number };
  pendingOnboard?: boolean;
  // Growth-engine signals (public/provided): drives the opportunity score.
  growth?: GrowthSignals;
  note: string;
}

const SANCTIONED = "0x000000000000000000000000000000000000dead" as Address; // on the watchlist

export const cohort: CohortMember[] = [
  { label: "Acme Treasury", address: "0x00000000000000000000000000000000c0ffee10", signals: { txCount: 6 },
    growth: { strategic: true, volume: 90, growth: 80, inbound: 30 }, note: "Clean + strategic (HSP/RWA) → Strategic prospect" },
  { label: "Beacon Fund", address: "0x00000000000000000000000000000000c0ffee11", signals: { txCount: 8 },
    growth: { volume: 95, growth: 90, inbound: 40 }, note: "Clean, high activity → Priority prospect" },
  { label: "New Applicant", address: "0x00000000000000000000000000000000c0ffee12", signals: { txCount: 4 }, pendingOnboard: true,
    growth: { inbound: 90, volume: 30, growth: 60 }, note: "Clean + large inbound capital → Priority, time-sensitive" },
  { label: "Zenith OTC", address: "0x00000000000000000000000000000000c0ffee14", counterparties: [SANCTIONED, "0x000000000000000000000000000000000000babe" as Address], signals: { txCount: 1 },
    growth: { strategic: true, volume: 80, growth: 50 }, note: "Valuable but model-high risk → escalate; onboard carefully" },
  { label: "Sanctioned Wallet", address: SANCTIONED, note: "Direct sanctions/watchlist hit — contained, not a prospect" },
];
