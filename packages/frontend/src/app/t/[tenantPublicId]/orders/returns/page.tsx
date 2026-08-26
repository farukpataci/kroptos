'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUturnLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import StatusBadge from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { pageWindow } from '@/lib/pagination';
import { Shipment, badgeType } from '../../shipping/shipmentStatus';
import { SubPageShell } from '../components/SubPageShell';

/**
 * The return leg of a shipment, as the carrier reports it. There is no Return
 * model — a return is a Shipment sitting in one of these three states, so this
 * page is a filtered shipment list rather than a resource of its own.
 */
const RETURN_STATUSES = ['undelivered', 'returning', 'returned'] as const;

interface ListResponse {
  items: Shipment[];
  total: number;
  page: number;
  pageSize: number;
}

/** Only what this page reads off an order. */
interface OrderRef {
  id: string;
  orderNumber: string;
  customerName: string;
}

export default function OrderReturnsPage() {
  const t = useTranslations('orderReturns');
  const tc = useTranslations('common');
  // shipping.status.* already names these three states in every locale that
  // has any of them; a second copy would be the same strings drifting apart.
  const ts = useTranslations('shipping');
  const { tenantContext } = useAuth();

  const [rows, setRows] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<Record<string, OrderRef>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Typing hits the API, so it waits for the typist to stop. Filtering the page
  // in hand instead would answer "no such return" for anything off page one.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!tenantContext.storeId && !tenantContext.agencyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // One status at a time: the endpoint takes a single value, so "all
      // returns" is three calls rather than a filter the API does not offer.
      const wanted = status ? [status] : RETURN_STATUSES;
      const pages = await Promise.all(
        wanted.map((s) =>
          api.get<ListResponse>('/api/shipments', {
            params: { page, pageSize, status: s, q: query || undefined },
          }),
        ),
      );
      const items = pages.flatMap((p) => p.items);
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setRows(items);
      setTotal(pages.reduce((sum, p) => sum + p.total, 0));
      setPageSize(pages[0]?.pageSize ?? pageSize);
    } catch (e: any) {
      // Shown, not swallowed: a 403 here means the role lacks shipments.read,
      // and an empty table would read as "no returns" instead of "not yours".
      setError(e?.message || t('loadFailed'));
      setRows([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [tenantContext.storeId, tenantContext.agencyId, page, pageSize, status, query, t]);

  // The shipment projection carries orderId but neither the order number nor
  // the buyer, and no endpoint joins them. The orders list is unpaginated
  // already, so it is read once and indexed by id.
  const loadOrders = useCallback(async () => {
    if (!tenantContext.storeId) return;
    try {
      const list = await api.get<OrderRef[]>('/api/orders');
      setOrders(Object.fromEntries((list || []).map((o) => [o.id, o])));
    } catch {
      // A failure here costs two columns, not the page.
    }
  }, [tenantContext.storeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagesShown = useMemo(() => pageWindow(page, totalPages), [page, totalPages]);

  return (
    <SubPageShell
      title={t('title')}
      subtitle={t('subtitle')}
      icon={ArrowUturnLeftIcon}
      error={error}
      onReload={load}
      isLoading={isLoading}
      reloadLabel={tc('actions.refresh')}
      actions={
        <>
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kp-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary py-2 pl-8 pr-4 text-xs text-kp-text-primary transition-colors placeholder:text-kp-text-tertiary focus:border-kp-accent focus:outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="cursor-pointer rounded-kp-md border border-kp-border bg-kp-bg-primary px-2.5 py-2 text-xs text-kp-text-primary focus:outline-none"
          >
            <option value="">{t('allStatuses')}</option>
            {RETURN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ts(`status.${s}`)}
              </option>
            ))}
          </select>
        </>
      }
    >
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-kp-border bg-kp-bg-primary/40 text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">
              <tr>
                <th className="px-4 py-3">{t('columns.reference')}</th>
                <th className="px-4 py-3">{t('columns.orderNumber')}</th>
                <th className="px-4 py-3">{t('columns.customer')}</th>
                <th className="px-4 py-3">{t('columns.carrier')}</th>
                <th className="px-4 py-3">{t('columns.trackingNumber')}</th>
                <th className="px-4 py-3">{t('columns.status')}</th>
                <th className="px-4 py-3">{t('columns.createdAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-kp-text-tertiary">
                    {tc('loading')}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-kp-text-tertiary">
                    {query ? t('emptySearch') : tc('noData')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const order = row.orderId ? orders[row.orderId] : undefined;
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-kp-bg-hover/30">
                      <td className="px-4 py-3.5 font-mono font-semibold text-kp-accent">
                        {row.referenceCode || '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-kp-text-primary">
                        {order?.orderNumber || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-kp-text-primary">
                        {order?.customerName || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-kp-text-secondary">{row.provider}</td>
                      <td className="px-4 py-3.5 font-mono text-kp-text-secondary">
                        {row.trackingNumber || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge
                          status={badgeType(row.status)}
                          label={ts(`status.${row.status}`)}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-kp-text-tertiary">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-kp-border px-4 py-3">
            <p className="text-xs text-kp-text-tertiary">{t('pagination', { total })}</p>
            <div className="flex items-center gap-1.5">
              {pagesShown.map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`h-7 min-w-7 rounded-kp-sm px-2 text-xs font-semibold transition-colors ${
                    n === page
                      ? 'bg-kp-accent text-white'
                      : 'text-kp-text-secondary hover:bg-kp-bg-hover'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </SubPageShell>
  );
}
