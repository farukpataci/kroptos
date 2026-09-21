'use client';

import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  XCircleIcon,
  TrashIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useExportJobs } from '../hooks/useExportJobs';
import { JobStatus } from '../types';

function formatBytes(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function StatusBadge({ status, progress }: { status: JobStatus; progress: number }) {
  switch (status) {
    case 'QUEUED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Sırada
        </span>
      );
    case 'PROCESSING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          İşleniyor ({progress}%)
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Tamamlandı
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Başarısız
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          İptal Edildi
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
          {status}
        </span>
      );
  }
}

export function ExportHistoryTab() {
  const {
    jobs,
    total,
    page,
    setPage,
    limit,
    statusFilter,
    setStatusFilter,
    isLoading,
    actionError,
    refreshJobs,
    downloadJob,
    cancelJob,
    rerunJob,
    deleteJob,
  } = useExportJobs();

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Durum Filtresi:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tümü ({total})</option>
            <option value="COMPLETED">Tamamlandı</option>
            <option value="PROCESSING">İşleniyor</option>
            <option value="QUEUED">Sırada</option>
            <option value="FAILED">Başarısız</option>
            <option value="CANCELLED">İptal Edildi</option>
          </select>
        </div>

        <button
          onClick={refreshJobs}
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
          {actionError}
        </div>
      )}

      {/* Jobs Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Tarih</th>
                <th className="px-6 py-4">Şablon / Açıklama</th>
                <th className="px-6 py-4">Format / Mod</th>
                <th className="px-6 py-4 text-center">Satır</th>
                <th className="px-6 py-4">Boyut</th>
                <th className="px-6 py-4 text-center">KVKK / PII</th>
                <th className="px-6 py-4 text-center">Durum</th>
                <th className="px-6 py-4 text-right">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <DocumentTextIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                    Henüz dışa aktarma kaydı bulunmuyor.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                      {new Date(job.createdAt).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {job.preset?.name || 'Özel Dışa Aktarma'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                        {job.fileName || `ID: ${job.id.slice(0, 10)}...`}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {job.format}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {job.rowMode === 'ORDER' ? 'Sipariş' : 'Kalem'}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-slate-800 dark:text-slate-200">
                      {job.totalRows !== null && job.totalRows !== undefined
                        ? job.totalRows.toLocaleString('tr-TR')
                        : '-'}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                      {formatBytes(job.fileSize)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {job.includesPii ? (
                        <span
                          title="Kişisel Veri (PII) içerir"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                        >
                          <LockClosedIcon className="h-3 w-3" />
                          PII
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge status={job.status} progress={job.progress} />
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {job.status === 'COMPLETED' && (
                          <button
                            onClick={() => downloadJob(job.id)}
                            title="Dosyayı İndir (5 dk geçerli token)"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg border border-emerald-200 dark:border-emerald-800 transition"
                          >
                            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                            İndir
                          </button>
                        )}

                        {(job.status === 'PROCESSING' || job.status === 'QUEUED') && (
                          <button
                            onClick={() => cancelJob(job.id)}
                            title="İşi İptal Et"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 rounded-lg border border-red-200 transition"
                          >
                            <XCircleIcon className="h-3.5 w-3.5" />
                            İptal
                          </button>
                        )}

                        {(job.status === 'COMPLETED' ||
                          job.status === 'FAILED' ||
                          job.status === 'CANCELLED') && (
                          <button
                            onClick={() => rerunJob(job.id)}
                            title="Aynı ayarlarla yeniden çalıştır"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => deleteJob(job.id)}
                          title="İşi ve dosyasını sil"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Toplam <span className="font-semibold">{total}</span> iş · Sayfa{' '}
              <span className="font-semibold">{page}</span> / {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                Önceki
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
