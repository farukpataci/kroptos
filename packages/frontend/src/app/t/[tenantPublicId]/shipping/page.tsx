'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TruckIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import StatusBadge from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';

/** Mirrors ShipmentService.toListItem — only the fields this table renders. */
interface Shipment {
  id: string;
  publicId: string;
  provider: string;
  status: string;
  trackingNumber: string | null;
  barcode: string | null;
  referenceCode: string | null;
  paymentType: string | null;
  codAmount: number | null;
  codCurrency: string | null;
  totalDesi: number | null;
  totalWeightKg: number | null;
  carrierCancelError: string | null;
  createdAt: string;
}

interface ListResponse {
  items: Shipment[];
  total: number;
  page: number;
  pageSize: number;
}

interface ProblemCounts {
  stuckClaims: number;
  carrierCancelFailed: number;
  total: number;
  stuckClaimAfterMinutes: number;
}

const STATUSES = [
  'created',
  'label_ready',
  'handed_over',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'undelivered',
  'returning',
  'returned',
  'cancelled',
  'lost',
];

/**
 * Only the states someone has to act on get a colour; anything still moving
 * stays neutral, so a coloured row in this list means work, not traffic.
 */
function badgeType(status: string) {
  if (status === 'delivered') return 'active';
  if (status === 'undelivered' || status === 'lost' || status === 'cancelled') return 'error';
  if (status === 'returning' || status === 'returned') return 'warning';
  return 'syncing';
}

const buttonClass =
  'flex items-center gap-2 rounded-kp-md border border-kp-border px-3 py-2 text-xs font-semibold text-kp-text-secondary transition-all hover:bg-kp-bg-hover disabled:opacity-40';

export default function ShippingPage() {
  const t = useTranslations('shipping');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [status, setStatus] = useState('');
  const [problem, setProblem] = useState('');
  const [problems, setProblems] = useState<ProblemCounts | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [list, counts] = await Promise.all([
        api.get<ListResponse>('/api/shipments', {
          params: { page, pageSize, status: status || undefined, problem: problem || undefined },
        }),
        api.get<ProblemCounts>('/api/shipments/problems'),
      ]);
      setShipments(list.items);
      setTotal(list.total);
      setPageSize(list.pageSize);
      setProblems(counts);
    } catch (e: any) {
      // Shown, not swallowed: a 403 here means the role lacks shipments.read,
      // and an empty table would read as "no shipments" instead of "not yours".
      setError(e?.message || t('errors.load'));
      setShipments([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, status, problem, t]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async (id: string) => {
    setRefreshingId(id);
    setError(null);
    try {
      const updated = await api.post<Shipment>(`/api/shipments/${id}/refresh`);
      setShipments((rows) => rows.map((row) => (row.id === id ? { ...row, ...updated } : row)));
    } catch (e: any) {
      setError(e?.message || t('errors.refresh'));
    } finally {
      setRefreshingId(null);
    }
  };

  // The list endpoint has no search parameter, so this filters the page in
  // hand — the placeholder says so rather than pretending to search all rows.
  const term = search.trim().toLowerCase();
  const visible = term
    ? shipments.filter((s) =>
        [s.barcode, s.trackingNumber, s.referenceCode, s.provider].some((field) =>
          field?.toLowerCase().includes(term),
        ),
      )
    : shipments;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstOnPage = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastOnPage = Math.min(page * pageSize, total);

  const setFilter = (next: { status?: string; problem?: string }) => {
    if (next.status !== undefined) setStatus(next.status);
    if (next.problem !== undefined) setProblem(next.problem);
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-kp-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <TruckIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">{t('title')}</h1>
            <p className="page-subtitle">{t('subtitle')}</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={isLoading} className={buttonClass}>
          <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('reload')}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3.5 py-2 text-theme-sm text-kp-danger">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {problems && problems.total > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-kp-md border border-kp-warning/40 bg-kp-warning-muted px-3.5 py-2 text-theme-sm">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-kp-warning" />
          <span className="text-kp-text-primary">
            {t('problems.summary', { count: problems.total })}
          </span>
          <button
            type="button"
            onClick={() => setFilter({ problem: problem === 'stuck_claim' ? '' : 'stuck_claim' })}
            className={`underline underline-offset-2 ${
              problem === 'stuck_claim' ? 'font-semibold text-kp-accent' : 'text-kp-text-secondary'
            }`}
          >
            {t('problems.stuckClaim', {
              count: problems.stuckClaims,
              minutes: problems.stuckClaimAfterMinutes,
            })}
          </button>
          <button
            type="button"
            onClick={() =>
              setFilter({
                problem: problem === 'carrier_cancel_failed' ? '' : 'carrier_cancel_failed',
              })
            }
            className={`underline underline-offset-2 ${
              problem === 'carrier_cancel_failed'
                ? 'font-semibold text-kp-accent'
                : 'text-kp-text-secondary'
            }`}
          >
            {t('problems.cancelFailed', { count: problems.carrierCancelFailed })}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[18rem] max-w-md flex-1 items-center gap-2 rounded-kp-md border border-kp-border bg-kp-bg-secondary px-3.5 py-2">
          <MagnifyingGlassIcon className="h-4 w-4 text-kp-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-transparent text-theme-sm text-kp-text-primary placeholder-kp-text-tertiary focus:outline-hidden"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setFilter({ status: e.target.value })}
          className="rounded-kp-md border border-kp-border bg-kp-bg-secondary px-3 py-2 text-theme-sm text-kp-text-primary"
        >
          <option value="">{t('allStatuses')}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="kp-table w-full border-collapse text-left text-theme-sm text-kp-text-secondary">
            <thead>
              <tr className="border-b border-kp-border bg-kp-bg-primary/30 text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
                <th className="py-3 px-4">{t('columns.barcode')}</th>
                <th className="py-3 px-4">{t('columns.trackingNumber')}</th>
                <th className="py-3 px-4">{t('columns.carrier')}</th>
                <th className="py-3 px-4">{t('columns.reference')}</th>
                <th className="py-3 px-4 text-center">{t('columns.desi')}</th>
                <th className="py-3 px-4 text-center">{t('columns.weight')}</th>
                <th className="py-3 px-4">{t('columns.cod')}</th>
                <th className="py-3 px-4">{t('columns.status')}</th>
                <th className="py-3 px-4">{t('columns.createdAt')}</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <ArrowPathIcon className="mx-auto h-6 w-6 animate-spin text-kp-accent" />
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-kp-text-tertiary">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                visible.map((shipment) => (
                  <tr key={shipment.id} className="transition-colors hover:bg-kp-bg-hover/30">
                    <td className="py-3.5 px-4 font-mono font-semibold text-kp-accent">
                      {shipment.barcode || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-kp-text-primary">
                      {shipment.trackingNumber || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-semibold uppercase text-kp-text-primary">
                      {shipment.provider}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {shipment.referenceCode || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">{shipment.totalDesi ?? '—'}</td>
                    <td className="py-3.5 px-4 text-center font-medium text-kp-text-primary">
                      {shipment.totalWeightKg != null ? `${shipment.totalWeightKg} kg` : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {shipment.paymentType === 'cod' && shipment.codAmount != null
                        ? `${shipment.codAmount} ${shipment.codCurrency || ''}`.trim()
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge
                        status={badgeType(shipment.status)}
                        label={t(`status.${shipment.status}`)}
                      />
                      {shipment.carrierCancelError && (
                        <span
                          className="ml-2 text-xs text-kp-danger"
                          title={shipment.carrierCancelError}
                        >
                          {t('cancelFailedTag')}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-kp-text-tertiary">
                      {new Date(shipment.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => refresh(shipment.id)}
                        disabled={refreshingId === shipment.id}
                        title={t('refreshTitle')}
                        className="text-kp-text-tertiary transition-colors hover:text-kp-accent disabled:opacity-50"
                      >
                        <ArrowPathIcon
                          className={`h-4 w-4 ${
                            refreshingId === shipment.id ? 'animate-spin' : ''
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-kp-border px-4 py-3 text-xs text-kp-text-tertiary">
          <span>{t('pagination.range', { first: firstOnPage, last: lastOnPage, total })}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('pagination.previous')}
            </button>
            <span>{t('pagination.page', { page, totalPages })}</span>
            <button
              type="button"
              className={buttonClass}
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('pagination.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
