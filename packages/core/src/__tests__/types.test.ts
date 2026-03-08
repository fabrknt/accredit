import { describe, it, expect } from 'vitest';
import { KycLevel, Jurisdiction } from '../kyc';
import { PoolStatus } from '../registry';

describe('KycLevel enum', () => {
  it('has correct numeric values', () => {
    expect(KycLevel.Basic).toBe(0);
    expect(KycLevel.Standard).toBe(1);
    expect(KycLevel.Enhanced).toBe(2);
    expect(KycLevel.Institutional).toBe(3);
  });

  it('supports reverse mapping (number to name)', () => {
    expect(KycLevel[0]).toBe('Basic');
    expect(KycLevel[1]).toBe('Standard');
    expect(KycLevel[2]).toBe('Enhanced');
    expect(KycLevel[3]).toBe('Institutional');
  });

  it('has exactly 4 members', () => {
    // Numeric enums have both forward and reverse mappings,
    // so we count only string keys
    const members = Object.keys(KycLevel).filter((k) => isNaN(Number(k)));
    expect(members).toHaveLength(4);
  });
});

describe('Jurisdiction enum', () => {
  it('has correct numeric values', () => {
    expect(Jurisdiction.Japan).toBe(0);
    expect(Jurisdiction.Singapore).toBe(1);
    expect(Jurisdiction.HongKong).toBe(2);
    expect(Jurisdiction.Eu).toBe(3);
    expect(Jurisdiction.Usa).toBe(4);
    expect(Jurisdiction.Other).toBe(5);
  });

  it('supports reverse mapping', () => {
    expect(Jurisdiction[0]).toBe('Japan');
    expect(Jurisdiction[1]).toBe('Singapore');
    expect(Jurisdiction[2]).toBe('HongKong');
    expect(Jurisdiction[3]).toBe('Eu');
    expect(Jurisdiction[4]).toBe('Usa');
    expect(Jurisdiction[5]).toBe('Other');
  });

  it('has exactly 6 members', () => {
    const members = Object.keys(Jurisdiction).filter((k) => isNaN(Number(k)));
    expect(members).toHaveLength(6);
  });
});

describe('PoolStatus enum', () => {
  it('has correct numeric values', () => {
    expect(PoolStatus.Active).toBe(0);
    expect(PoolStatus.Suspended).toBe(1);
    expect(PoolStatus.Revoked).toBe(2);
  });

  it('supports reverse mapping', () => {
    expect(PoolStatus[0]).toBe('Active');
    expect(PoolStatus[1]).toBe('Suspended');
    expect(PoolStatus[2]).toBe('Revoked');
  });

  it('has exactly 3 members', () => {
    const members = Object.keys(PoolStatus).filter((k) => isNaN(Number(k)));
    expect(members).toHaveLength(3);
  });
});
