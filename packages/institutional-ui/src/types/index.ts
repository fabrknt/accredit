import type { KycLevel, Jurisdiction } from '@fabrknt/accredit-core';

/** Result of a single compliance check */
export interface ComplianceResult {
  wallet: string;
  isCompliant: boolean;
  kycLevel: KycLevel | null;
  jurisdiction: Jurisdiction | null;
  reason?: string;
}

/** Result for batch compliance check */
export interface BatchResult {
  wallet: string;
  isCompliant: boolean;
  kycLevel: KycLevel | null;
  jurisdiction: Jurisdiction | null;
  reason?: string;
}

/** KYC provider info */
export interface ProviderInfo {
  id: string;
  name: string;
  supportedJurisdictions: Jurisdiction[];
  supportedLevels: KycLevel[];
  isActive: boolean;
}

/** Wrapper configuration for display */
export interface WrapperConfig {
  address: string;
  underlyingMint: string;
  wrappedMint: string;
  authority: string;
  totalSupply: string;
  isActive: boolean;
  minKycLevel: KycLevel;
  feeBasisPoints: number;
  jurisdictionBitmask: number;
}

/** Pool status response from API */
export interface PoolStatusResponse {
  ammKey: string;
  dexLabel: string;
  status: 'active' | 'suspended' | 'revoked';
  jurisdiction: Jurisdiction;
  kycLevel: KycLevel;
  auditExpiry: number;
  registeredAt: number;
}

/** Column definition for DataTable */
export interface ColumnDef<T> {
  label: string;
  key: string;
  render?: (row: T) => React.ReactNode;
}

/** Navigation item */
export interface NavItem {
  label: string;
  path: string;
  icon: string;
}
