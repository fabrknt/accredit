import { StatCard } from '../components/analytics/StatCard';

export function DashboardPage() {
  // In production, these values would come from API calls
  return (
    <div className="page-dashboard">
      <div className="stat-grid">
        <StatCard
          label="Total Wallets Verified"
          value="375"
          subtitle="+12 this week"
          variant="default"
        />
        <StatCard
          label="Active Pools"
          value="48"
          subtitle="3 pending audit"
          variant="success"
        />
        <StatCard
          label="Wrapped Assets"
          value="6"
          subtitle="2 active wrappers"
          variant="default"
        />
        <StatCard
          label="Compliance Rate"
          value="97.2%"
          subtitle="+0.4% from last week"
          variant="success"
        />
      </div>

      <div className="dashboard-sections">
        <div className="card">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            <ActivityItem
              time="2 min ago"
              description="KYC verification completed for wallet 8xK2...nP4d"
              type="success"
            />
            <ActivityItem
              time="15 min ago"
              description="Pool Raydium/SOL-USDC audit renewed"
              type="success"
            />
            <ActivityItem
              time="1 hour ago"
              description="Compliance check failed for wallet 3mR7...bQ9x"
              type="danger"
            />
            <ActivityItem
              time="2 hours ago"
              description="New wrapper deployed for USDC-KYC"
              type="default"
            />
            <ActivityItem
              time="3 hours ago"
              description="Pool Orca/SOL-USDT status changed to Suspended"
              type="warning"
            />
            <ActivityItem
              time="5 hours ago"
              description="Batch compliance check: 24/25 wallets passed"
              type="success"
            />
          </div>
        </div>

        <div className="card">
          <h3>System Status</h3>
          <div className="system-status-list">
            <SystemStatusRow label="Transfer Hook Program" status="operational" />
            <SystemStatusRow label="Compliant Registry" status="operational" />
            <SystemStatusRow label="Sovereign SDK" status="operational" />
            <SystemStatusRow label="KYC Provider API" status="operational" />
            <SystemStatusRow label="QN Addon" status="operational" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({
  time,
  description,
  type,
}: {
  time: string;
  description: string;
  type: 'success' | 'danger' | 'warning' | 'default';
}) {
  return (
    <div className={`activity-item activity-item-${type}`}>
      <span className="activity-dot" />
      <div className="activity-content">
        <span className="activity-description">{description}</span>
        <span className="activity-time">{time}</span>
      </div>
    </div>
  );
}

function SystemStatusRow({
  label,
  status,
}: {
  label: string;
  status: 'operational' | 'degraded' | 'down';
}) {
  const statusColors: Record<string, string> = {
    operational: 'var(--color-green)',
    degraded: 'var(--color-yellow)',
    down: 'var(--color-red)',
  };
  return (
    <div className="system-status-row">
      <span>{label}</span>
      <span className="system-status-indicator">
        <span
          className="status-dot"
          style={{ backgroundColor: statusColors[status] }}
        />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  );
}
