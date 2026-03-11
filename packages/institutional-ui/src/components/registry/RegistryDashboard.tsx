import { StatCard } from '../analytics/StatCard';
import { PoolTable } from './PoolTable';
import type { PoolStatusResponse } from '../../types';

interface RegistryDashboardProps {
  pools: PoolStatusResponse[];
  loading: boolean;
  error: string | null;
}

export function RegistryDashboard({
  pools,
  loading,
  error,
}: RegistryDashboardProps) {
  const activeCount = pools.filter((p) => p.status === 'active').length;
  const suspendedCount = pools.filter((p) => p.status === 'suspended').length;
  const revokedCount = pools.filter((p) => p.status === 'revoked').length;

  return (
    <div className="registry-dashboard">
      <div className="stat-grid">
        <StatCard label="Total Pools" value={pools.length} />
        <StatCard label="Active" value={activeCount} variant="success" />
        <StatCard label="Suspended" value={suspendedCount} variant="warning" />
        <StatCard label="Revoked" value={revokedCount} variant="danger" />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h3>Registered Pools</h3>
        {loading ? (
          <p className="loading-text">Loading pool data...</p>
        ) : (
          <PoolTable pools={pools} />
        )}
      </div>
    </div>
  );
}
