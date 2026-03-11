import { StatCard } from '../analytics/StatCard';
import { WrapperCard } from './WrapperCard';
import type { WrapperConfig } from '../../types';

interface WrapperDashboardProps {
  wrappers: WrapperConfig[];
  loading: boolean;
  error: string | null;
}

export function WrapperDashboard({
  wrappers,
  loading,
  error,
}: WrapperDashboardProps) {
  const activeCount = wrappers.filter((w) => w.isActive).length;
  const totalFees = wrappers.reduce((sum, w) => sum + w.feeBasisPoints, 0);
  const avgFee = wrappers.length > 0 ? Math.round(totalFees / wrappers.length) : 0;

  return (
    <div className="wrapper-dashboard">
      <div className="stat-grid">
        <StatCard label="Total Wrappers" value={wrappers.length} />
        <StatCard label="Active" value={activeCount} variant="success" />
        <StatCard
          label="Inactive"
          value={wrappers.length - activeCount}
          variant="warning"
        />
        <StatCard
          label="Avg Fee"
          value={`${avgFee} bps`}
          subtitle="Basis points"
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="loading-text">Loading wrapper configs...</p>
      ) : wrappers.length === 0 ? (
        <div className="card">
          <p className="empty-state">No wrapper configurations found</p>
        </div>
      ) : (
        <div className="wrapper-grid">
          {wrappers.map((wrapper) => (
            <WrapperCard key={wrapper.address} wrapper={wrapper} />
          ))}
        </div>
      )}
    </div>
  );
}
