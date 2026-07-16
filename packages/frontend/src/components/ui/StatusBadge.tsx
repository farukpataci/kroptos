'use client';

type StatusType = 'active' | 'warning' | 'error' | 'syncing' | 'inactive';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showDot?: boolean;
}

const statusConfig: Record<StatusType, { dotClass: string; badgeClass: string; label: string }> = {
  active: {
    dotClass: 'status-dot--active',
    badgeClass: 'badge--success',
    label: 'Active',
  },
  warning: {
    dotClass: 'status-dot--warning',
    badgeClass: 'badge--warning',
    label: 'Warning',
  },
  error: {
    dotClass: 'status-dot--error',
    badgeClass: 'badge--danger',
    label: 'Error',
  },
  syncing: {
    dotClass: 'status-dot--syncing',
    badgeClass: 'badge--accent',
    label: 'Syncing',
  },
  inactive: {
    dotClass: '',
    badgeClass: '',
    label: 'Inactive',
  },
};

export default function StatusBadge({ status, label, showDot = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <span className={`badge ${config.badgeClass} inline-flex items-center gap-1.5`}>
      {showDot && <span className={`status-dot ${config.dotClass}`} />}
      {displayLabel}
    </span>
  );
}
