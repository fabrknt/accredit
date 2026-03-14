import { KycLevel, Jurisdiction } from '@fabrknt/accredit-core';
import { StatCard } from './StatCard';

interface DistributionItem {
  label: string;
  count: number;
  color: string;
}

function BarChart({ items, title }: { items: DistributionItem[]; title: string }) {
  const maxCount = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="bar-chart">
      <h3 className="bar-chart-title">{title}</h3>
      <div className="bar-chart-items">
        {items.map((item) => (
          <div key={item.label} className="bar-chart-row">
            <span className="bar-chart-label">{item.label}</span>
            <div className="bar-chart-track">
              <div
                className="bar-chart-fill"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <span className="bar-chart-count">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const JURISDICTION_COLORS: Record<number, string> = {
  [Jurisdiction.Japan]: '#3b82f6',
  [Jurisdiction.Singapore]: '#10b981',
  [Jurisdiction.HongKong]: '#f59e0b',
  [Jurisdiction.Eu]: '#8b5cf6',
  [Jurisdiction.Usa]: '#ef4444',
  [Jurisdiction.Other]: '#6b7280',
};

const KYC_LEVEL_COLORS: Record<number, string> = {
  [KycLevel.Basic]: '#6b7280',
  [KycLevel.Standard]: '#3b82f6',
  [KycLevel.Enhanced]: '#8b5cf6',
  [KycLevel.Institutional]: '#10b981',
};

export function AnalyticsOverview() {
  // In production, these would come from API calls
  const jurisdictionData: DistributionItem[] = [
    { label: 'Japan', count: 142, color: JURISDICTION_COLORS[Jurisdiction.Japan] },
    { label: 'Singapore', count: 89, color: JURISDICTION_COLORS[Jurisdiction.Singapore] },
    { label: 'Hong Kong', count: 67, color: JURISDICTION_COLORS[Jurisdiction.HongKong] },
    { label: 'EU', count: 54, color: JURISDICTION_COLORS[Jurisdiction.Eu] },
    { label: 'USA', count: 0, color: JURISDICTION_COLORS[Jurisdiction.Usa] },
    { label: 'Other', count: 23, color: JURISDICTION_COLORS[Jurisdiction.Other] },
  ];

  const kycLevelData: DistributionItem[] = [
    { label: 'Basic', count: 198, color: KYC_LEVEL_COLORS[KycLevel.Basic] },
    { label: 'Standard', count: 112, color: KYC_LEVEL_COLORS[KycLevel.Standard] },
    { label: 'Enhanced', count: 45, color: KYC_LEVEL_COLORS[KycLevel.Enhanced] },
    { label: 'Institutional', count: 20, color: KYC_LEVEL_COLORS[KycLevel.Institutional] },
  ];

  const complianceHistory: DistributionItem[] = [
    { label: 'Passed', count: 1247, color: '#10b981' },
    { label: 'Failed', count: 83, color: '#ef4444' },
    { label: 'Pending', count: 12, color: '#f59e0b' },
  ];

  return (
    <div className="analytics-overview">
      <div className="stat-grid">
        <StatCard label="Total Checks (24h)" value="342" variant="default" />
        <StatCard
          label="Pass Rate"
          value="93.7%"
          subtitle="+1.2% from yesterday"
          variant="success"
        />
        <StatCard
          label="Avg Response Time"
          value="124ms"
          subtitle="P95: 280ms"
          variant="default"
        />
        <StatCard
          label="Blocked Transactions"
          value="17"
          subtitle="Last 24 hours"
          variant="danger"
        />
      </div>

      <div className="analytics-charts">
        <div className="card">
          <BarChart items={jurisdictionData} title="Jurisdiction Distribution" />
        </div>
        <div className="card">
          <BarChart items={kycLevelData} title="KYC Level Distribution" />
        </div>
        <div className="card">
          <BarChart items={complianceHistory} title="Compliance Check Results" />
        </div>
      </div>
    </div>
  );
}
