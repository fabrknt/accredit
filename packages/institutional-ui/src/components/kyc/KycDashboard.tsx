import type { WhitelistEntry } from '@fabrknt/accredit-core';
import { Jurisdiction } from '@fabrknt/accredit-core';
import { StatCard } from '../analytics/StatCard';
import { KycEntryTable } from './KycEntryTable';
import { KycBatchPanel } from './KycBatchPanel';

interface KycDashboardProps {
  entries: WhitelistEntry[];
  loading: boolean;
  error: string | null;
}

function getJurisdictionLabel(j: Jurisdiction): string {
  const labels: Record<Jurisdiction, string> = {
    [Jurisdiction.Japan]: 'JP',
    [Jurisdiction.Singapore]: 'SG',
    [Jurisdiction.HongKong]: 'HK',
    [Jurisdiction.Eu]: 'EU',
    [Jurisdiction.Usa]: 'US',
    [Jurisdiction.Other]: 'Other',
  };
  return labels[j] ?? '?';
}

export function KycDashboard({ entries, loading, error }: KycDashboardProps) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const activeCount = entries.filter(
    (e) => e.isActive && (e.expiryTimestamp === 0n || e.expiryTimestamp > now),
  ).length;
  const expiredCount = entries.filter(
    (e) => e.expiryTimestamp > 0n && e.expiryTimestamp < now,
  ).length;

  // Jurisdiction breakdown
  const byJurisdiction = entries.reduce<Record<string, number>>((acc, e) => {
    const label = getJurisdictionLabel(e.jurisdiction);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const jurisdictionSummary = Object.entries(byJurisdiction)
    .map(([label, count]) => `${label}: ${count}`)
    .join(', ');

  return (
    <div className="kyc-dashboard">
      <div className="stat-grid">
        <StatCard label="Total Entries" value={entries.length} />
        <StatCard label="Active" value={activeCount} variant="success" />
        <StatCard label="Expired" value={expiredCount} variant="warning" />
        <StatCard
          label="By Jurisdiction"
          value={Object.keys(byJurisdiction).length}
          subtitle={jurisdictionSummary || '--'}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="kyc-content">
        <div className="card">
          <h3>Whitelist Entries</h3>
          {loading ? (
            <p className="loading-text">Loading KYC entries...</p>
          ) : (
            <KycEntryTable entries={entries} />
          )}
        </div>
        <div className="card">
          <KycBatchPanel />
        </div>
      </div>
    </div>
  );
}
