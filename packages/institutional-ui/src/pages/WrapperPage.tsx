import { useState, useMemo } from 'react';
import { KycLevel } from '@fabrknt/accredit-core';
import { WrapperDashboard } from '../components/wrapper/WrapperDashboard';
import type { WrapperConfig } from '../types';

function generateSampleWrappers(): WrapperConfig[] {
  return [
    {
      address: 'CWRPxn8XsLkWW5fN5RYkWRQr5o4bT1RaAi3AhAPDnj1L',
      underlyingMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      wrappedMint: '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT',
      authority: '8xK2mNpQr5vT7wLcBn3dYzJf6hA9sGkEuP4dRtXqW1m',
      totalSupply: '1,250,000.00',
      isActive: true,
      minKycLevel: KycLevel.Standard,
      feeBasisPoints: 25,
      jurisdictionBitmask: 0b001111,
    },
    {
      address: '9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYYJ7b',
      underlyingMint: 'So11111111111111111111111111111111111111112',
      wrappedMint: 'Ak2GJPnMFxQPTfwxVEqy4pEB9bRNSpYJ5rLgE9UWJSQL',
      authority: '8xK2mNpQr5vT7wLcBn3dYzJf6hA9sGkEuP4dRtXqW1m',
      totalSupply: '5,420.50',
      isActive: true,
      minKycLevel: KycLevel.Basic,
      feeBasisPoints: 10,
      jurisdictionBitmask: 0b011111,
    },
    {
      address: 'H4JcMPicKkHNMhsDF7ecp1pMFfnPxj4fLwR1acW4RfPK',
      underlyingMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      wrappedMint: 'BjRMzD3NLFqVaKnAQkCB9rHfiPmERg3iPSd9AcWJpump',
      authority: '3mR7kLpY2wN8xJcVbQ9xTfAeHg5sZd6uR1nPqW4mK7v',
      totalSupply: '890.25',
      isActive: false,
      minKycLevel: KycLevel.Enhanced,
      feeBasisPoints: 50,
      jurisdictionBitmask: 0b000011,
    },
  ];
}

export function WrapperPage() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  // Use sample data; in production, replace with useWrapperData hook
  const wrappers = useMemo(() => generateSampleWrappers(), []);

  return <WrapperDashboard wrappers={wrappers} loading={loading} error={error} />;
}
