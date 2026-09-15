'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CommandLineIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export interface AgentJobItem {
  id: string;
  agencyId: string;
  agentId: string;
  integrationId: string;
  companyKey: string;
  type: string;
  payload: any;
  idempotencyKey?: string | null;
  status: 'queued' | 'dispatched' | 'running' | 'ok' | 'failed' | 'expired';
  attempt: number;
  notBefore?: string | null;
  expiresAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  errorCode?: string | null;
  resultRef?: any;
  createdAt: string;
}

export default function AgentJobList() {
  const toast = useToast();
  const [jobs, setJobs] = useState<AgentJobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = statusFilter !== 'all' ? `/agents/jobs?status=${statusFilter}` : '/agents/jobs';
      const data = await api.get<AgentJobItem[]>(url);
      setJobs(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Agent iş kuyruğu yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return (
    <div className="space-y-4">
      {/* Header filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2">
          <CommandLineIcon className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Agent İş Kuyruğu (Agent Jobs)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Agent tüneline gönderilen fatura, cari, stok ve katalog işlerinin durumları (K6: kapalı küme).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="running">Çalışıyor (Running)</option>
            <option value="queued">Kuyrukta (Queued)</option>
            <option value="dispatched">Gönderildi (Dispatched)</option>
            <option value="ok">Başarılı (OK)</option>
            <option value="failed">Hata (Failed)</option>
            <option value="expired">Zaman Aşımı (Expired)</option>
          </select>

          <button
            onClick={loadJobs}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <ArrowPathIcon className="h-6 w-6 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center">
            <ClockIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">İş Kaydı Yok</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Henüz işlenmiş veya kuyrukta bekleyen bir Agent işi bulunmuyor.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-5 py-3">İş Tipi (JobType)</th>
                  <th className="px-5 py-3">Durum</th>
                  <th className="px-5 py-3">Firma (SessionKey)</th>
                  <th className="px-5 py-3">İdempotency Anahtarı</th>
                  <th className="px-5 py-3">Deneme</th>
                  <th className="px-5 py-3">Süre</th>
                  <th className="px-5 py-3">Oluşturulma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {jobs.map((job) => {
                  return (
                    <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold font-mono text-slate-900 dark:text-white">{job.type}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Job: {job.id}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            job.status === 'ok'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : job.status === 'failed'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : job.status === 'running'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : job.status === 'expired'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                          }`}
                        >
                          {job.status === 'ok' && <CheckCircleIcon className="h-3 w-3" />}
                          {job.status === 'failed' && <XCircleIcon className="h-3 w-3" />}
                          {job.status === 'running' && <ArrowPathIcon className="h-3 w-3 animate-spin" />}
                          {job.status.toUpperCase()}
                        </span>
                        {job.errorCode && (
                          <div className="text-[10px] text-rose-500 font-mono mt-0.5">{job.errorCode}</div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {job.companyKey || '—'}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {job.idempotencyKey || '—'}
                      </td>

                      <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                        {job.attempt}
                      </td>

                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        {job.durationMs !== null && job.durationMs !== undefined ? `${job.durationMs} ms` : '—'}
                      </td>

                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(job.createdAt).toLocaleString('tr-TR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
