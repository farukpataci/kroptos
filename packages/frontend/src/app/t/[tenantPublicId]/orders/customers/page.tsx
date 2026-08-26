'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UsersIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { pageWindow } from '@/lib/pagination';
import { SubPageShell } from '../components/SubPageShell';
import { Buyer, BuyerSourceOrder, buyerMatches, groupBuyers } from '../buyers';

const PAGE_SIZE = 25;

/**
 * Buyers — the people who placed the orders. Not `/clients`, which is the
 * agency's own tenant customer; these two are different populations and the
 * sidebar deliberately calls this one "Alıcılar".
 */
export default function OrderCustomersPage() {
  const t = useTranslations('orderCustomers');
  const tc = useTranslations('common');
  const { tenantContext } = useAuth();

  const [orders, setOrders] = useState<BuyerSourceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!tenantContext.storeId) {
      // Buyers are rolled up out of orders, and orders only list under a store.
      setIsLoading(false);
      setOrders([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setOrders((await api.get<BuyerSourceOrder[]>('/api/orders')) || []);
    } catch (e: any) {
      // Shown, not swallowed: a 403 here means the role lacks orders.read, and
      // an empty table would read as "no buyers" instead of "not yours".
      setError(e?.message || t('loadFailed'));
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantContext.storeId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const buyers = useMemo(() => groupBuyers(orders), [orders]);
  const filtered = useMemo(
    () => buyers.filter((buyer) => buyerMatches(buyer, search)),
    [buyers, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagesShown = pageWindow(page, totalPages);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const money = (totals: Buyer['totalsByCurrency']) =>
    Object.entries(totals)
      .map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`)
      .join(' · ');

  const noStore = !isLoading && !error && !tenantContext.storeId;

  return (
    <SubPageShell
      title={t('title')}
      subtitle={t('subtitle')}
      icon={UsersIcon}
      error={error}
      onReload={load}
      isLoading={isLoading}
      reloadLabel={tc('actions.refresh')}
      actions={
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
      }
    >
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-kp-border bg-kp-bg-primary/40 text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">
              <tr>
                <th className="px-4 py-3">{t('columns.name')}</th>
                <th className="px-4 py-3">{t('columns.email')}</th>
                <th className="px-4 py-3">{t('columns.phone')}</th>
                <th className="px-4 py-3 text-center">{t('columns.orderCount')}</th>
                <th className="px-4 py-3">{t('columns.totalSpend')}</th>
                <th className="px-4 py-3">{t('columns.lastOrder')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-kp-text-tertiary">
                    {tc('loading')}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-kp-text-tertiary">
                    {noStore ? t('storeRequired') : search ? t('emptySearch') : tc('noData')}
                  </td>
                </tr>
              ) : (
                rows.map((buyer) => (
                  <tr key={buyer.key} className="transition-colors hover:bg-kp-bg-hover/30">
                    <td className="px-4 py-3.5 font-semibold text-kp-text-primary">{buyer.name}</td>
                    <td className="px-4 py-3.5 text-kp-text-secondary">{buyer.email || '—'}</td>
                    <td className="px-4 py-3.5 font-mono text-kp-text-secondary">
                      {buyer.phone || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-kp-text-primary">
                      {buyer.orderCount}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-kp-text-primary">
                      {money(buyer.totalsByCurrency)}
                    </td>
                    <td className="px-4 py-3.5 text-kp-text-tertiary">
                      {new Date(buyer.lastOrderAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-kp-border px-4 py-3">
            <p className="text-xs text-kp-text-tertiary">
              {t('pagination', { total: filtered.length })}
            </p>
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
