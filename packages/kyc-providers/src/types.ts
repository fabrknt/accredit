import { KycLevel, Jurisdiction } from '@fabrknt/accredit-core';

export interface ProviderVerificationResult {
  verified: boolean;
  provider: string;
  kycLevel: KycLevel;
  jurisdiction: Jurisdiction;
  providerUserId: string;
  proofData: Uint8Array;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export interface VerificationSession {
  sessionId: string;
  provider: string;
  wallet: string;
  verificationUrl?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
  expiresAt: number;
}

export interface KycProvider {
  readonly name: string;
  checkVerification(wallet: string): Promise<ProviderVerificationResult | null>;
  initiateVerification(wallet: string, opts?: VerificationOptions): Promise<VerificationSession>;
  validateProof(proofData: Uint8Array): Promise<boolean>;
  mapToKycLevel(providerTier: unknown): KycLevel;
}

export interface VerificationOptions {
  jurisdiction?: Jurisdiction;
  requiredLevel?: KycLevel;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export type AggregationStrategy = 'any' | 'all' | 'majority' | 'highest';

export interface ProviderAggregatorConfig {
  providers: KycProvider[];
  strategy: AggregationStrategy;
  minProviders?: number;
}

export interface AggregateVerificationResult {
  verified: boolean;
  kycLevel: KycLevel;
  jurisdiction: Jurisdiction;
  results: ProviderVerificationResult[];
  strategy: AggregationStrategy;
  timestamp: number;
}
