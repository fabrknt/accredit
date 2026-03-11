import { useState, useMemo } from 'react';
import { Jurisdiction, KycLevel } from '@accredit/core';
import { RegistryDashboard } from '../components/registry/RegistryDashboard';
import type { PoolStatusResponse } from '../types';

function generateSamplePools(): PoolStatusResponse[] {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;

  return [
    {
      ammKey: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
      dexLabel: 'Raydium',
      status: 'active',
      jurisdiction: Jurisdiction.Japan,
      kycLevel: KycLevel.Standard,
      auditExpiry: now + 180 * day,
      registeredAt: now - 90 * day,
    },
    {
      ammKey: 'HJPjoWUrhoZpdrDEg1vjYoodsAi6LGjJHVo7QLRzppBh',
      dexLabel: 'Orca',
      status: 'active',
      jurisdiction: Jurisdiction.Singapore,
      kycLevel: KycLevel.Basic,
      auditExpiry: now + 120 * day,
      registeredAt: now - 60 * day,
    },
    {
      ammKey: '7XaWhFF8riGfPEDrhSAPKg1vSWzCio3tCVX5t5aV5jrG',
      dexLabel: 'Meteora',
      status: 'active',
      jurisdiction: Jurisdiction.HongKong,
      kycLevel: KycLevel.Enhanced,
      auditExpiry: now + 90 * day,
      registeredAt: now - 120 * day,
    },
    {
      ammKey: '9RfPGmj9UZ3VQaGFM4JuD9sCNqj1QJ9q7Ghr8j7bRkCV',
      dexLabel: 'Raydium',
      status: 'suspended',
      jurisdiction: Jurisdiction.Eu,
      kycLevel: KycLevel.Standard,
      auditExpiry: now - 10 * day,
      registeredAt: now - 200 * day,
    },
    {
      ammKey: 'BAmGkFTeBmhAkNLsQfRNvfFwPGQ3GwBARjzNbgqPaQfB',
      dexLabel: 'Orca',
      status: 'revoked',
      jurisdiction: Jurisdiction.Japan,
      kycLevel: KycLevel.Institutional,
      auditExpiry: now - 60 * day,
      registeredAt: now - 365 * day,
    },
  ];
}

export function RegistryPage() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  // Use sample data; in production, replace with useRegistryData hook
  const pools = useMemo(() => generateSamplePools(), []);

  return <RegistryDashboard pools={pools} loading={loading} error={error} />;
}
