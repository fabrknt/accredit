import type { KycLevel, Jurisdiction } from './kyc';

/** Pool compliance status */
export enum PoolStatus {
  Active = 0,
  Suspended = 1,
  Revoked = 2,
}

/** On-chain PoolComplianceEntry deserialized (chain-agnostic) */
export interface PoolComplianceEntry {
  ammKey: string;
  registry: string;
  operator: string;
  dexLabel: string;
  status: PoolStatus;
  jurisdiction: Jurisdiction;
  kycLevel: KycLevel;
  auditHash: Uint8Array;
  auditExpiry: number;
  registeredAt: number;
  updatedAt: number;
}

/** Compliant quote result wrapping aggregator response */
export interface CompliantQuoteResult {
  quote: QuoteResponse;
  wasFiltered: boolean;
  compliantHopCount: number;
  traderKycLevel: KycLevel;
  traderJurisdiction: Jurisdiction;
}

/** Compliance check result for a single route */
export interface RouteComplianceResult {
  isCompliant: boolean;
  nonCompliantPools: string[];
  compliantPools: string[];
}

/** Configuration for ComplianceAwareRouter */
export interface ComplianceRouterConfig {
  /** RPC connection URL */
  rpcUrl?: string;
  /** Compliant registry program/contract address */
  registryAddress?: string;
  /** Transfer-hook/compliance contract address */
  complianceAddress?: string;
  /** DEX aggregator API base URL */
  aggregatorApiBaseUrl?: string;
  /** Default slippage in basis points */
  defaultSlippageBps?: number;
  /** Whether to fall back to direct routes when multi-hop fails compliance */
  fallbackToDirectRoutes?: boolean;
  /** Maximum route hops to consider */
  maxRouteHops?: number;
  /** @deprecated Use registryAddress */
  registryProgramId?: unknown;
  /** @deprecated Use complianceAddress */
  transferHookProgramId?: unknown;
  /** @deprecated Use aggregatorApiBaseUrl */
  jupiterApiBaseUrl?: string;
}

/** On-chain ComplianceConfig deserialized (chain-agnostic) */
export interface ComplianceConfig {
  authority: string;
  poolRegistry: string;
  kycRegistry: string;
  jurisdictionBitmask: number;
  basicTradeLimit: bigint;
  standardTradeLimit: bigint;
  enhancedTradeLimit: bigint;
  zkVerifierKey: string;
  isActive: boolean;
  maxRouteHops: number;
  createdAt: bigint;
  updatedAt: bigint;
  bump: number;
}

/** ZK compliance proof for privacy-preserving KYC verification */
export interface ZkComplianceProof {
  proof: Uint8Array;
  publicInputs: Uint8Array[];
  circuitId: string;
  kycLevelCommitment: Uint8Array;
  jurisdictionCommitment: Uint8Array;
}

/** DEX aggregator configuration */
export interface AggregatorConfig {
  apiBaseUrl?: string;
  defaultSlippageBps?: number;
  maxRoutes?: number;
  timeoutMs?: number;
}

export interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
  maxAccounts?: number;
}

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: RoutePlanStep[];
  contextSlot: number;
  timeTaken: number;
}

export interface RoutePlanStep {
  swapInfo: SwapInfo;
  percent: number;
}

export interface SwapInfo {
  ammKey: string;
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  feeAmount: string;
  feeMint: string;
}

export interface SwapRoute {
  quote: QuoteResponse;
  steps: RouteStep[];
  totalFee: string;
  priceImpact: number;
  effectivePrice: number;
}

export interface RouteStep {
  dex: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  fee: string;
}

export interface SwapParams {
  quoteResponse: QuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  dynamicComputeUnitLimit?: boolean;
  prioritizationFeeLamports?: number | 'auto';
}

export interface SwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}
