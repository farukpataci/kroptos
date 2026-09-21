'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
  ClockIcon,
  EyeIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { useAutomationRuns } from '../hooks/useAutomationRuns';
import { AutomationRun } from '../types';
import RunDetailModal from './RunDetailModal';

export default function RunHistoryTab() {
  const t = useTranslations('orderAutomation');
  const params = useParams();
  const tenantPublicId = (params?.tenantPublicId as string) || '';

  const {
    runs,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    error,
    filters,
    setFilters,
    setPage,
    reload,
    retryRun,
  } = useAutomationRuns();

  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 rounded-kp-xs bg-kp-success-muted px-2 py-0.5 text-xs font-semibold text-kp-success">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Başarılı
          </span>
        );
      case 'PARTIAL_SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 rounded-kp-xs bg-kp-warning-muted px-2 py-0.5 text-xs font-semibold text-kp-warning">
            <ClockIcon className="h-3.5 w-3.5" />
            Kısmi Başarılı
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 rounded-kp-xs bg-kp-danger-muted px-2 py-0.5 text-xs font-semibold text-kp-danger">
            <XCircleIcon className="h-3.5 w-3.5" />
            Başarısız
          </span>
        );
      case 'SKIPPED':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-kp-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-kp-text-tertiary">
            <MinusCircleIcon className="h-3.5 w-3.5" />
            Atlandı
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter and Control Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-kp-lg border border-kp-border bg-white dark:bg-slate-900 p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-4 w-4 text-kp-text-tertiary" />
            <select
              value={filters.status || 'ALL'}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  status: e.target.value === 'ALL' ? undefined : e.target.value,
                }))
              }
              className="rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none"
            >
              <option value="ALL">Tüm Sonuçlar</option>
              <option value="SUCCESS">Yalnız Başarılılar</option>
              <option value="PARTIAL_SUCCESS">Kısmi Başarılılar</option>
              <option value="FAILED">Yalnız Hatalılar</option>
              <option value="SKIPPED">Yalnız Atlananlar</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-kp-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!filters.includeSkipped}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, includeSkipped: e.target.checked }))
              }
              className="h-3.5 w-3.5 rounded border-kp-border text-kp-accent focus:ring-kp-accent"
            />
            <span>Eşleşmeyenleri (Atlanan) da göster</span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => reload()}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-kp-text-primary transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Yenile</span>
        </button>
      </div>

      {error && (
        <div className="rounded-kp-md bg-kp-danger-muted p-3 text-xs text-kp-danger">
          {error}
        </div>
      )}

      {/* Runs Table */}
      <div className="overflow-hidden rounded-kp-xl border border-kp-border bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-kp-border bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-kp-text-tertiary">
              <tr>
                <th className="px-4 py-3">Zaman</th>
                <th className="px-4 py-3">Kural</th>
                <th className="px-4 py-3">Sipariş No</th>
                <th className="px-4 py-3">Tetikleyici</th>
                <th className="px-4 py-3">Sonuç</th>
                <th className="px-4 py-3">Süre</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {isLoading && runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-kp-text-tertiary">
                    Yükleniyor...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <ClockIcon className="h-8 w-8 text-kp-text-tertiary" />
                      <div className="text-xs font-medium text-kp-text-secondary">
                        Kayıtlı otomasyon çalışması bulunamadı
                      </div>
                      <div className="text-[11px] text-kp-text-tertiary">
                        Sipariş oluşturulduğunda veya tetikleyiciler çalıştığında günlük burada listelenir.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="whitespace-nowrap px-4 py-3 text-kp-text-secondary">
                      {new Date(run.createdAt).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-kp-text-primary">
                      {run.rule?.name || (
                        <span className="text-kp-text-tertiary italic">Silinmiş Kural</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {run.order?.orderNumber ? (
                        <Link
                          href={`/t/${tenantPublicId}/orders/${run.order.id}`}
                          className="font-mono text-kp-accent hover:underline font-medium"
                        >
                          {run.order.orderNumber}
                        </Link>
                      ) : (
                        <span className="font-mono text-kp-text-tertiary">{run.orderId.slice(0, 8)}...</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-kp-text-secondary">
                      <span className="rounded-kp-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px]">
                        {run.triggerEvent}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {statusBadge(run.status)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-kp-text-tertiary font-mono">
                      {run.durationMs} ms
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedRun(run)}
                        className="inline-flex items-center gap-1 rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-kp-text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-kp-text-primary transition-colors"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        <span>Detay</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-kp-border px-4 py-3 text-xs text-kp-text-secondary bg-slate-100/70 dark:bg-slate-950">
            <div>
              Toplam <span className="font-semibold text-kp-text-primary">{total}</span> çalışmadan{' '}
              <span className="font-semibold text-kp-text-primary">{(page - 1) * limit + 1}</span> -{' '}
              <span className="font-semibold text-kp-text-primary">
                {Math.min(page * limit, total)}
              </span>{' '}
              arası gösteriliyor
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium text-kp-text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                Önceki
              </button>
              <span className="font-medium text-kp-text-primary">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-kp-md border border-kp-border bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium text-kp-text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Run Detail Modal */}
      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          onRetry={retryRun}
        />
      )}
    </div>
  );
}
