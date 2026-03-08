import { describe, it, expect } from 'vitest';
import {
  KycLevel,
  Jurisdiction,
  KYC_TRADE_LIMITS,
  isJurisdictionInBitmask,
  isJurisdictionAllowed,
} from '../kyc';

describe('isJurisdictionInBitmask', () => {
  it('returns true when the jurisdiction bit is set', () => {
    // bitmask with bit 0 (Japan) set => 0b000001 = 1
    expect(isJurisdictionInBitmask(Jurisdiction.Japan, 0b000001)).toBe(true);
  });

  it('returns false when the jurisdiction bit is not set', () => {
    // bitmask with only Japan set; Singapore (bit 1) should be false
    expect(isJurisdictionInBitmask(Jurisdiction.Singapore, 0b000001)).toBe(false);
  });

  it('handles bitmask with multiple jurisdictions set', () => {
    // Japan (0), HongKong (2), Eu (3) => 0b001101 = 13
    const bitmask = (1 << Jurisdiction.Japan) | (1 << Jurisdiction.HongKong) | (1 << Jurisdiction.Eu);
    expect(isJurisdictionInBitmask(Jurisdiction.Japan, bitmask)).toBe(true);
    expect(isJurisdictionInBitmask(Jurisdiction.Singapore, bitmask)).toBe(false);
    expect(isJurisdictionInBitmask(Jurisdiction.HongKong, bitmask)).toBe(true);
    expect(isJurisdictionInBitmask(Jurisdiction.Eu, bitmask)).toBe(true);
    expect(isJurisdictionInBitmask(Jurisdiction.Usa, bitmask)).toBe(false);
    expect(isJurisdictionInBitmask(Jurisdiction.Other, bitmask)).toBe(false);
  });

  it('returns false when bitmask is 0 (no jurisdictions)', () => {
    expect(isJurisdictionInBitmask(Jurisdiction.Japan, 0)).toBe(false);
    expect(isJurisdictionInBitmask(Jurisdiction.Usa, 0)).toBe(false);
  });

  it('returns true for all jurisdictions when bitmask is all-ones', () => {
    const allSet = 0b111111; // bits 0-5
    expect(isJurisdictionInBitmask(Jurisdiction.Japan, allSet)).toBe(true);
    expect(isJurisdictionInBitmask(Jurisdiction.Singapore, allSet)).toBe(true);
    expect(isJurisdictionInBitmask(Jurisdiction.HongKong, allSet)).toBe(true);
    expect(isJurisdictionInBitmask(Jurisdiction.Eu, allSet)).toBe(true);
    expect(isJurisdictionInBitmask(Jurisdiction.Usa, allSet)).toBe(true);
    expect(isJurisdictionInBitmask(Jurisdiction.Other, allSet)).toBe(true);
  });
});

describe('isJurisdictionAllowed', () => {
  it('allows Japan', () => {
    expect(isJurisdictionAllowed(Jurisdiction.Japan)).toBe(true);
  });

  it('allows Singapore', () => {
    expect(isJurisdictionAllowed(Jurisdiction.Singapore)).toBe(true);
  });

  it('allows Hong Kong', () => {
    expect(isJurisdictionAllowed(Jurisdiction.HongKong)).toBe(true);
  });

  it('allows EU', () => {
    expect(isJurisdictionAllowed(Jurisdiction.Eu)).toBe(true);
  });

  it('disallows USA', () => {
    expect(isJurisdictionAllowed(Jurisdiction.Usa)).toBe(false);
  });

  it('allows Other', () => {
    expect(isJurisdictionAllowed(Jurisdiction.Other)).toBe(true);
  });
});

describe('KYC_TRADE_LIMITS', () => {
  it('has an entry for every KycLevel', () => {
    expect(KYC_TRADE_LIMITS[KycLevel.Basic]).toBeDefined();
    expect(KYC_TRADE_LIMITS[KycLevel.Standard]).toBeDefined();
    expect(KYC_TRADE_LIMITS[KycLevel.Enhanced]).toBeDefined();
    expect(KYC_TRADE_LIMITS[KycLevel.Institutional]).toBeDefined();
  });

  it('limits increase with KYC level', () => {
    expect(KYC_TRADE_LIMITS[KycLevel.Basic]).toBeLessThan(KYC_TRADE_LIMITS[KycLevel.Standard]);
    expect(KYC_TRADE_LIMITS[KycLevel.Standard]).toBeLessThan(KYC_TRADE_LIMITS[KycLevel.Enhanced]);
    expect(KYC_TRADE_LIMITS[KycLevel.Enhanced]).toBeLessThan(KYC_TRADE_LIMITS[KycLevel.Institutional]);
  });

  it('Basic limit equals 100,000 JPY (6 decimals)', () => {
    expect(KYC_TRADE_LIMITS[KycLevel.Basic]).toBe(100_000_000_000n);
  });

  it('Standard limit equals 10,000,000 JPY (6 decimals)', () => {
    expect(KYC_TRADE_LIMITS[KycLevel.Standard]).toBe(10_000_000_000_000n);
  });

  it('Enhanced limit equals 100,000,000 JPY (6 decimals)', () => {
    expect(KYC_TRADE_LIMITS[KycLevel.Enhanced]).toBe(100_000_000_000_000n);
  });

  it('Institutional limit equals u64::MAX', () => {
    expect(KYC_TRADE_LIMITS[KycLevel.Institutional]).toBe(BigInt('18446744073709551615'));
  });

  it('all limits are bigint values', () => {
    for (const level of [KycLevel.Basic, KycLevel.Standard, KycLevel.Enhanced, KycLevel.Institutional]) {
      expect(typeof KYC_TRADE_LIMITS[level]).toBe('bigint');
    }
  });
});
