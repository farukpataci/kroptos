'use client';

type StatusType = 'active' | 'warning' | 'error' | 'syncing' | 'inactive';

interface StatusBadgeProps {
  /**
   * Values outside `StatusType` are tolerated on purpose: statuses arrive from
   * the API as plain strings, so a value this build has no styling for must
   * degrade to a neutral badge rather than take the page down.
   */
  status: StatusType | (string & {});
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
  // An unmapped status keeps the neutral styling and names itself, so an
  // unexpected value is visible as such instead of being dressed up as one of
  // the known states.
  const config = statusConfig[status as StatusType] ?? {
    dotClass: '',
    badgeClass: '',
    label: status,
  };
  const displayLabel = label || config.label;

  return (
    <span className={`badge ${config.badgeClass} inline-flex items-center gap-1.5`}>
      {showDot && <span className={`status-dot ${config.dotClass}`} />}
      {displayLabel}
    </span>
  );
}
