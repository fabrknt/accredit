// SPDX-License-Identifier: Apache-2.0
// Shared types for the accredit AI-AML scorer. CC-provided stub; Codex implements
// the features/model/chain modules against these contracts.

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type RiskBand = "low" | "medium" | "high";

/** Read-only chain access, injected so the model stays unit-testable without network. */
export interface ChainReader {
  /** Total transactions sent from `address` (nonce). */
  getTxCount(address: Address): Promise<number>;
  /** True if `address` has contract code deployed. */
  hasCode(address: Address): Promise<boolean>;
}

/** Everything a feature may inspect to score one address. */
export interface ScoringContext {
  address: Address;
  /** Known counterparties (1-hop) for exposure analysis. */
  counterparties: Address[];
  /** Flagged/sanctioned addresses (lowercased) from the watchlist. */
  watchlist: Set<Address>;
  /** On-chain reads, if available (CLI provides; tests may omit). */
  chain?: ChainReader;
  /** Optional precomputed signals for tests/demo without network. */
  signals?: {
    txCount?: number;
    hasCode?: boolean;
  };
}

/** One feature's contribution to the risk score. */
export interface FeatureResult {
  id: string;
  /** Relative weight of this feature. */
  weight: number;
  /** This feature's raw 0–100 risk reading. */
  score: number;
  /** Human-readable explanation of why it fired. */
  reason: string;
}

export type Feature = (ctx: ScoringContext) => Promise<FeatureResult> | FeatureResult;

/** Final scoring verdict, ready to anchor on-chain. */
export interface RiskResult {
  address: Address;
  /** Clamped 0–100 integer. */
  score: number;
  band: RiskBand;
  reasons: string[];
  breakdown: FeatureResult[];
  /** keccak256("accredit-aml/<modelId>@<version>") — auditable from chain. */
  modelRef: Hex;
}

export interface ModelConfig {
  modelId: string;
  version: string;
  features: readonly Feature[];
}

export interface SubmitAttestationParams {
  account: Address;
  score: number;
  modelRef: Hex;
}
