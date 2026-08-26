'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlusIcon, QueueListIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { SubPageShell } from '@/components/layout/SubPageShell';

/**
 * The statuses the system itself writes, in the order an order moves through
 * them. Mirrors STATUS_ITEMS in OrderStatusSidebar and the enum documented on
 * `Order.status` in schema.prisma — `status` is a plain string column, so this
 * list is a convention, not a constraint the database enforces.
 */
const SYSTEM_STATUSES = [
  { value: 'pending', dotClass: 'bg-amber-400' },
  { value: 'processing', dotClass: 'bg-blue-400' },
  { value: 'shipped', dotClass: 'bg-violet-400' },
  { value: 'delivered', dotClass: 'bg-emerald-400' },
  { value: 'cancelled', dotClass: 'bg-red-400' },
];

export default function OrderStatusesPage() {
  const t = useTranslations('orderStatuses');
  const to = useTranslations('orders');
  const tc = useTranslations('common');
  const { tenantContext } = useAuth();

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** The request still in flight, so a newer one can cancel it. */
  const inFlight = useRef<AbortController | null>(null);
  /** Monotonic ticket: only the newest request may write to state. */
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    if (!tenantContext.storeId) {
      setIsLoading(false);
      setCounts({});
      return;
    }

    // Same guard as the other two Orders pages — see customers/page.tsx.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const ticket = ++latestRequest.current;

    setIsLoading(true);
    setError(null);
    try {
      const orders = await api.get<{ status: string }[]>('/api/orders', {
        signal: controller.signal,
      });
      if (ticket !== latestRequest.current) return;
      const tally: Record<string, number> = {};
      for (const order of orders || []) {
        tally[order.status] = (tally[order.status] || 0) + 1;
      }
      setCounts(tally);
    } catch (e: any) {
      if (e?.name === 'AbortError' || ticket !== latestRequest.current) return;
      setError(e?.message || t('loadFailed'));
      setCounts({});
    } finally {
      if (ticket === latestRequest.current) setIsLoading(false);
    }
  }, [tenantContext.storeId, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Anything in the data that is not one of ours. Marketplace mappers write
  // `status` as free text, so a value nobody declared shows up here rather than
  // being silently dropped off a hard-coded list.
  const unknown = useMemo(() => {
    const known = new Set(SYSTEM_STATUSES.map((s) => s.value));
    return Object.keys(counts)
      .filter((value) => !known.has(value))
      .sort();
  }, [counts]);

  const rows = [
    ...SYSTEM_STATUSES.map((s) => ({ ...s, isSystem: true, label: to(`status.${s.value}`) })),
    ...unknown.map((value) => ({
      value,
      dotClass: 'bg-slate-400',
      isSystem: false,
      label: value,
    })),
  ];

  return (
    <SubPageShell
      title={t('title')}
      subtitle={t('subtitle')}
      icon={QueueListIcon}
      error={error}
      onReload={load}
      isLoading={isLoading}
      reloadLabel={tc('actions.refresh')}
      actions={
        // TODO(backend): POST /api/orders/statuses — there is no status table,
        // so a custom status has nowhere to be stored yet.
        <button
          type="button"
          disabled
          title={t('createDisabled')}
          className="flex cursor-not-allowed items-center gap-2 rounded-kp-md border border-kp-border px-3 py-2 text-xs font-semibold text-kp-text-secondary opacity-40"
        >
          <PlusIcon className="h-4 w-4" />
          {t('create')}
        </button>
      }
    >
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-kp-border bg-kp-bg-primary/40 text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">
              <tr>
                <th className="px-4 py-3">{t('columns.name')}</th>
                <th className="px-4 py-3">{t('columns.key')}</th>
                <th className="px-4 py-3">{t('columns.kind')}</th>
                <th className="px-4 py-3 text-right">{t('columns.orderCount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {rows.map((row) => (
                <tr key={row.value} className="transition-colors hover:bg-kp-bg-hover/30">
                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-2.5 font-semibold text-kp-text-primary">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dotClass}`} />
                      {row.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-kp-text-secondary">{row.value}</td>
                  <td className="px-4 py-3.5 text-kp-text-secondary">
                    {row.isSystem ? t('kind.system') : t('kind.unknown')}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-kp-text-primary">
                    {isLoading ? '—' : counts[row.value] || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {unknown.length > 0 && (
        <p className="text-xs text-kp-text-tertiary">{t('unknownNote', { count: unknown.length })}</p>
      )}
    </SubPageShell>
  );
}
