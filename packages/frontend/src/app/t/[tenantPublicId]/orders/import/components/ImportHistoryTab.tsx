'use client';

import React from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useImportJobs } from '../hooks/useImportJobs';
import { ImportJobStatus } from '../types';

export function ImportHistoryTab() {
  const {
    jobs,
    isLoading,
    total,
    page,
    setPage,
    actionLoadingId,
    rollbackJob,
    deleteJob,
    downloadErrorReport,
  } = useImportJobs();

  const getStatusBadge = (status: ImportJobStatus) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Tamamlandı
          </span>
        );
      case 'COMPLETED_WITH_ERRORS':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
            <ExclamationCircleIcon className="h-3.5 w-3.5" />
            Hatalarla Bitti
          </span>
        );
      case 'PROCESSING':
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
            İşleniyor
          </span>
        );
      case 'ROLLING_BACK':
      case 'ROLLED_BACK':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
            Geri Alındı
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400">
            <XCircleIcon className="h-3.5 w-3.5" />
            Başarısız
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            İçe Aktarma Geçmişi
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Geçmişte yüklenen sipariş dosyaları, işlem sayaçları ve geri alma kayıtları.
          </p>
        </div>

        <span className="text-xs text-slate-500">
          Toplam <b>{total}</b> içe aktarma
        </span>
      </div>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-sm">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-indigo-500" />
          Geçmiş yükleniyor...
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
          Henüz tamamlanmış bir içe aktarma bulunmuyor.
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Tarih</th>
                <th className="p-3">Dosya Adı</th>
                <th className="p-3">Mod</th>
                <th className="p-3 text-center">Oluşturulan</th>
                <th className="p-3 text-center">Güncellenen</th>
                <th className="p-3 text-center">Hatalı</th>
                <th className="p-3">Durum</th>
                <th className="p-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.map((job) => {
                const canRollback =
                  (job.status === 'COMPLETED' || job.status === 'COMPLETED_WITH_ERRORS') &&
                  job.rollbackDeadline &&
                  new Date(job.rollbackDeadline) > new Date();

                return (
                  <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono text-slate-500">
                      {new Date(job.createdAt).toLocaleString('tr-TR')}
                    </td>
                    <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                      {job.fileName}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {(job.fileSize / 1024).toFixed(1)} KB · {job.totalRows || 0} satır
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                      {job.mode}
                    </td>
                    <td className="p-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                      {job.createdCount}
                    </td>
                    <td className="p-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                      {job.updatedCount}
                    </td>
                    <td className="p-3 text-center font-semibold text-red-500">
                      {job.failedCount}
                    </td>
                    <td className="p-3">{getStatusBadge(job.status)}</td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      {job.errorReportKey && (
                        <button
                          onClick={() => downloadErrorReport(job.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition"
                          title="Hata Raporunu İndir"
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5 text-red-500" />
                          Hata Raporu
                        </button>
                      )}

                      {canRollback && (
                        <button
                          onClick={() => rollbackJob(job.id)}
                          disabled={actionLoadingId === job.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-[11px] font-semibold transition disabled:opacity-50"
                          title="İçe Aktarmayı Geri Al"
                        >
                          <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                          Geri Al
                        </button>
                      )}

                      <button
                        onClick={() => deleteJob(job.id)}
                        disabled={actionLoadingId === job.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                        title="Kaydı Sil"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 text-xs font-semibold"
          >
            Önceki
          </button>
          <span className="text-xs text-slate-500">Sayfa {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 20 >= total}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 text-xs font-semibold"
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
}
