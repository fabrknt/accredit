type BadgeStatus = 'active' | 'suspended' | 'revoked' | 'expired' | 'pending';

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
}

const STATUS_CLASS_MAP: Record<BadgeStatus, string> = {
  active: 'badge-active',
  suspended: 'badge-pending',
  revoked: 'badge-revoked',
  expired: 'badge-revoked',
  pending: 'badge-pending',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${STATUS_CLASS_MAP[status]}`}>
      {label ?? status}
    </span>
  );
}
