interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function StatCard({
  label,
  value,
  subtitle,
  variant = 'default',
}: StatCardProps) {
  return (
    <div className={`stat-card stat-card-${variant}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
    </div>
  );
}
