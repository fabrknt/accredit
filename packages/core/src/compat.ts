/**
 * Compatibility layer for API consumers that use string-based enums.
 *
 * The SDK's on-chain types use numeric enums (KycLevel.Basic = 0,
 * Jurisdiction.Japan = 0).  The API layer uses string unions
 * ("basic", "MAS", etc.).
 *
 * This module provides:
 * - String union types that mirror the API's convention
 * - Bidirectional conversion utilities
 *
 * Existing exports are not affected.
 */

import { KycLevel, Jurisdiction } from './kyc';

// ---------------------------------------------------------------------------
// String-based type aliases
// ---------------------------------------------------------------------------

/** KYC level as a human-readable string (API convention). */
export type KycLevelString = 'none' | 'basic' | 'standard' | 'enhanced' | 'institutional';

/** Jurisdiction as a regulatory-body string (API convention). */
export type JurisdictionString = 'MAS' | 'SFC' | 'FSA' | 'SEC' | 'FCA' | 'FINMA' | 'BaFin';

// ---------------------------------------------------------------------------
// KycLevel conversions
// ---------------------------------------------------------------------------

const KYC_LEVEL_TO_STRING: Record<KycLevel, KycLevelString> = {
  [KycLevel.Basic]: 'basic',
  [KycLevel.Standard]: 'standard',
  [KycLevel.Enhanced]: 'enhanced',
  [KycLevel.Institutional]: 'institutional',
};

const KYC_STRING_TO_LEVEL: Record<KycLevelString, KycLevel> = {
  none: KycLevel.Basic,        // "none" maps to lowest on-chain level
  basic: KycLevel.Basic,
  standard: KycLevel.Standard,
  enhanced: KycLevel.Enhanced,
  institutional: KycLevel.Institutional,
};

/**
 * Convert a numeric KycLevel enum value to its string representation.
 *
 * ```ts
 * kycLevelToString(KycLevel.Enhanced) // => "enhanced"
 * ```
 */
export function kycLevelToString(level: KycLevel): KycLevelString {
  return KYC_LEVEL_TO_STRING[level] ?? 'basic';
}

/**
 * Convert a string KYC level to the numeric KycLevel enum.
 *
 * ```ts
 * kycLevelFromString("enhanced") // => KycLevel.Enhanced (2)
 * ```
 */
export function kycLevelFromString(level: KycLevelString): KycLevel {
  return KYC_STRING_TO_LEVEL[level] ?? KycLevel.Basic;
}

// ---------------------------------------------------------------------------
// Jurisdiction conversions
// ---------------------------------------------------------------------------

const JURISDICTION_TO_STRING: Record<Jurisdiction, JurisdictionString> = {
  [Jurisdiction.Japan]: 'FSA',
  [Jurisdiction.Singapore]: 'MAS',
  [Jurisdiction.HongKong]: 'SFC',
  [Jurisdiction.Eu]: 'BaFin',     // EU maps to BaFin (largest EU regulator)
  [Jurisdiction.Usa]: 'SEC',
  [Jurisdiction.Other]: 'FINMA',  // fallback to FINMA for "Other"
};

const JURISDICTION_STRING_TO_ENUM: Record<JurisdictionString, Jurisdiction> = {
  FSA: Jurisdiction.Japan,
  MAS: Jurisdiction.Singapore,
  SFC: Jurisdiction.HongKong,
  SEC: Jurisdiction.Usa,
  FCA: Jurisdiction.Eu,          // FCA treated as EU-adjacent
  FINMA: Jurisdiction.Other,
  BaFin: Jurisdiction.Eu,
};

/**
 * Convert a numeric Jurisdiction enum value to its string representation.
 *
 * ```ts
 * jurisdictionToString(Jurisdiction.Singapore) // => "MAS"
 * ```
 */
export function jurisdictionToString(jurisdiction: Jurisdiction): JurisdictionString {
  return JURISDICTION_TO_STRING[jurisdiction] ?? 'FINMA';
}

/**
 * Convert a jurisdiction string to the numeric Jurisdiction enum.
 *
 * ```ts
 * jurisdictionFromString("MAS") // => Jurisdiction.Singapore (1)
 * ```
 */
export function jurisdictionFromString(jurisdiction: JurisdictionString): Jurisdiction {
  return JURISDICTION_STRING_TO_ENUM[jurisdiction] ?? Jurisdiction.Other;
}
