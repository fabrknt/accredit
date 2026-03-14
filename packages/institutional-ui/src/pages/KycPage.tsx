import { useState, useMemo } from 'react';
import { KycLevel, Jurisdiction } from '@fabrknt/accredit-core';
import type { WhitelistEntry } from '@fabrknt/accredit-core';
import { KycDashboard } from '../components/kyc/KycDashboard';

/** Generate sample KYC entries for development/demo */
function generateSampleEntries(): WhitelistEntry[] {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const day = 86400n;

  const samples: WhitelistEntry[] = [
    {
      wallet: '8xK2mNpQr5vT7wLcBn3dYzJf6hA9sGkEuP4dRtXqW1m',
      registry: '66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA',
      kycLevel: KycLevel.Institutional,
      jurisdiction: Jurisdiction.Japan,
      kycHash: new Uint8Array(32),
      isActive: true,
      dailyLimit: 100_000_000_000_000n,
      dailyVolume: 5_000_000_000n,
      volumeResetTime: now - 3600n,
      verifiedAt: now - 90n * day,
      expiryTimestamp: now + 275n * day,
      lastActivity: now - 1800n,
      createdAt: now - 90n * day,
      bump: 255,
    },
    {
      wallet: '3mR7kLpY2wN8xJcVbQ9xTfAeHg5sZd6uR1nPqW4mK7v',
      registry: '66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA',
      kycLevel: KycLevel.Enhanced,
      jurisdiction: Jurisdiction.Singapore,
      kycHash: new Uint8Array(32),
      isActive: true,
      dailyLimit: 100_000_000_000_000n,
      dailyVolume: 12_000_000_000n,
      volumeResetTime: now - 7200n,
      verifiedAt: now - 45n * day,
      expiryTimestamp: now + 320n * day,
      lastActivity: now - 600n,
      createdAt: now - 45n * day,
      bump: 254,
    },
    {
      wallet: 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS',
      registry: '66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA',
      kycLevel: KycLevel.Standard,
      jurisdiction: Jurisdiction.HongKong,
      kycHash: new Uint8Array(32),
      isActive: true,
      dailyLimit: 10_000_000_000_000n,
      dailyVolume: 0n,
      volumeResetTime: now - day,
      verifiedAt: now - 120n * day,
      expiryTimestamp: now + 245n * day,
      lastActivity: now - 86400n,
      createdAt: now - 120n * day,
      bump: 253,
    },
    {
      wallet: '5ZWj7a1f8tWkjBESHKgrLmXhvhSedqGo2FjMYxXq9q1X',
      registry: '66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA',
      kycLevel: KycLevel.Basic,
      jurisdiction: Jurisdiction.Eu,
      kycHash: new Uint8Array(32),
      isActive: true,
      dailyLimit: 100_000_000_000n,
      dailyVolume: 50_000_000n,
      volumeResetTime: now - 1200n,
      verifiedAt: now - 30n * day,
      expiryTimestamp: now + 335n * day,
      lastActivity: now - 3600n,
      createdAt: now - 30n * day,
      bump: 252,
    },
    {
      wallet: 'DRpbCBMxVnDK7maPMoGQfFm5Z4eGUkRWtbSxkqRFnBhi',
      registry: '66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA',
      kycLevel: KycLevel.Enhanced,
      jurisdiction: Jurisdiction.Japan,
      kycHash: new Uint8Array(32),
      isActive: false,
      dailyLimit: 100_000_000_000_000n,
      dailyVolume: 0n,
      volumeResetTime: 0n,
      verifiedAt: now - 400n * day,
      expiryTimestamp: now - 35n * day,
      lastActivity: now - 200n * day,
      createdAt: now - 400n * day,
      bump: 251,
    },
    {
      wallet: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLMbzTRe6R5p',
      registry: '66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA',
      kycLevel: KycLevel.Standard,
      jurisdiction: Jurisdiction.Singapore,
      kycHash: new Uint8Array(32),
      isActive: true,
      dailyLimit: 10_000_000_000_000n,
      dailyVolume: 2_500_000_000n,
      volumeResetTime: now - 900n,
      verifiedAt: now - 60n * day,
      expiryTimestamp: now - 5n * day,
      lastActivity: now - 7200n,
      createdAt: now - 60n * day,
      bump: 250,
    },
  ];

  return samples;
}

export function KycPage() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  // Use sample data; in production, replace with useKycData hook
  const entries = useMemo(() => generateSampleEntries(), []);

  return <KycDashboard entries={entries} loading={loading} error={error} />;
}
