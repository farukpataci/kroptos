'use client';

import { useTranslations } from 'next-intl';
import { OrderFilters } from '../hooks/useOrders';

interface OrderStatusSidebarProps {
  filters: OrderFilters;
  statusCounts: Record<string, number>;
  onFilterChange: (filters: OrderFilters) => void;
}

const STATUS_ITEMS = [
  { value: 'pending', dotClass: 'bg-amber-400' },
  { value: 'processing', dotClass: 'bg-blue-400' },
  { value: 'shipped', dotClass: 'bg-violet-400' },
  { value: 'delivered', dotClass: 'bg-emerald-400' },
  { value: 'cancelled', dotClass: 'bg-red-400' },
];

export default function OrderStatusSidebar({
  filters,
  statusCounts,
  onFilterChange,
}: OrderStatusSidebarProps) {
  const t = useTranslations('orders');
  const tc = useTranslations('common');
  const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const renderItem = (
    value: string,
    label: string,
    count: number,
    dotClass: string,
  ) => {
    const isActive = filters.status === value;
    return (
      <button
        key={value}
        onClick={() => onFilterChange({ ...filters, status: value })}
        aria-current={isActive ? 'true' : undefined}
        className={`
          group flex w-full items-center gap-2.5 rounded-kp-md px-2.5 py-2 text-left text-[0.75rem] font-medium transition-colors
          ${isActive
            ? 'bg-kp-accent/10 text-kp-accent'
            : 'text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary'
          }
        `}
      >
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotClass}`} />
        <span className="flex-1 truncate">{label}</span>
        <span
          className={`
            rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums transition-colors
            ${isActive
              ? 'bg-kp-accent/15 text-kp-accent'
              : 'bg-kp-bg-tertiary text-kp-text-tertiary group-hover:text-kp-text-secondary'
            }
          `}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="p-4 space-y-3">
      <nav className="space-y-0.5">
        {renderItem('all', tc('all'), totalCount, 'bg-kp-text-tertiary')}

        <div className="pt-2">
          <p className="px-2.5 pb-1 text-[0.625rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
            {t('orderStatusTitle')}
          </p>
          <div className="space-y-0.5">
            {STATUS_ITEMS.map((item) =>
              renderItem(
                item.value,
                t(`status.${item.value}`),
                statusCounts[item.value] || 0,
                item.dotClass,
              ),
            )}
          </div>
        </div>
      </nav>
    </div>
  );

}
