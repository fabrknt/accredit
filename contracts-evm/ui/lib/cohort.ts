// Demo cohort the AI operator sweeps over. Addresses are deterministic demo wallets;
// `signals`/`counterparties` drive the scorer to a designed spread of risk bands.
// `pendingOnboard: true` means "not yet KYC-registered" (the sweep should onboard it).
import type { Address } from "viem";

export interface CohortMember {
  label: string;
  address: Address;
  counterparties?: Address[];
  signals?: { txCount?: number };
  pendingOnboard?: boolean;
  note: string;
}

const SANCTIONED = "0x000000000000000000000000000000000000dead" as Address; // on the watchlist

export const cohort: CohortMember[] = [
  { label: "Acme Treasury", address: "0x00000000000000000000000000000000c0ffee10", signals: { txCount: 6 }, note: "Established, no exposure" },
  { label: "Beacon Fund", address: "0x00000000000000000000000000000000c0ffee11", signals: { txCount: 8 }, note: "Established, no exposure" },
  { label: "New Applicant", address: "0x00000000000000000000000000000000c0ffee12", signals: { txCount: 4 }, pendingOnboard: true, note: "Pending onboarding, clean" },
  { label: "Zenith OTC", address: "0x00000000000000000000000000000000c0ffee14", counterparties: [SANCTIONED, "0x000000000000000000000000000000000000babe" as Address], signals: { txCount: 1 }, note: "Multiple sanctioned counterparties + fresh (model-high → escalate)" },
  { label: "Sanctioned Wallet", address: SANCTIONED, note: "Direct sanctions/watchlist hit" },
];
