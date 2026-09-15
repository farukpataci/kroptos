'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  XMarkIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export interface AccountingProblemItem {
  id: string;
  agencyId: string;
  integrationId?: string | null;
  agentId?: string | null;
  companyKey?: string | null;
  code: string;
  severity: 'info' | 'warn' | 'error';
  occurrences: number;
  detail?: any;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

const PROBLEM_LABELS: Record<string, { label: string; desc: string }> = {
  agent_offline: { label: 'Agent Çevrimdışı', desc: 'Agent tüneli kapandı ve kalp atışı alınamıyor.' },
  agent_failover_blocked: { label: 'Devralma Bloke Edildi', desc: 'Açık yazma işi varken Agent devralması güvenlik gereği engellendi (K9).' },
  erp_auth_failed: { label: 'ERP Kimlik Doğrulama Hatası', desc: 'Mikro / ERP API geçersiz şifre veya kimlik hatası döndürdü.' },
  erp_session_limit: { label: 'Oturum Sınırı Aşıldı', desc: 'Eşzamanlı kullanıcı tavanına ulaşıldı.' },
  erp_clock_skew: { label: 'Sunucu Saat Farkı (K8)', desc: 'Agent ile ERP sunucusu arasında izin verilen saat farkı eşiği aşıldı.' },
  mapping_missing: { label: 'Eşleştirme Eksik', desc: 'Ürün, depo veya cari eşleştirmesi bulunamadı.' },
  stock_sync_stale: { label: 'Stok Senkronizasyonu Bayat', desc: 'Son başarılı stok çekimi üzerinden 3 periyot geçti (§10.2).' },
  invoice_stuck: { label: 'Fatura Askıda (Stuck Claim)', desc: 'Zaman aşımı veya ağ kopması nedeniyle fatura durumu belirsiz (§10.1).' },
  catalog_schema_drift: { label: 'Katalog Şema Uyuşmazlığı', desc: 'ERP SQL kataloğundan beklenen kolonlar dönmedi (K7).' },
};

export default function AccountingProblemQueue() {
  const toast = useToast();
  const [problems, setProblems] = useState<AccountingProblemItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [inspectProblem, setInspectProblem] = useState<AccountingProblemItem | null>(null);

  const loadProblems = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<AccountingProblemItem[]>(
        `/accounting/problems?includeResolved=${includeResolved ? 'true' : 'false'}`,
      );
      setProblems(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Problem kuyruğu yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [includeResolved, toast]);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await api.post(`/accounting/problems/${id}/resolve`, {});
      toast.success('Problem çözüldü olarak işaretlendi.');
      await loadProblems();
    } catch (err: any) {
      toast.error(err.message || 'Problem çözülemedi.');
    } finally {
      setResolvingId(null);
    }
  };

  const unresolvedCount = problems.filter((p) => !p.resolvedAt).length;

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2">
          <ShieldExclamationIcon className="h-5 w-5 text-amber-500" />
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Muhasebe Problem & Hata Kuyruğu
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Agent tüneli, ERP oturumları ve asılı faturalara ilişkin operasyonel uyarılar.
            </p>
          </div>
          {unresolvedCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 border border-rose-500/20">
              {unresolvedCount} Açık
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(e) => setIncludeResolved(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Çözülenleri Göster
          </label>
          <button
            onClick={loadProblems}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* Problems Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <ArrowPathIcon className="h-6 w-6 animate-spin" />
          </div>
        ) : problems.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-emerald-400" />
            <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">Kuyrukta Problem Yok</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Tüm muhasebe ve Agent servisleri olağan şekilde çalışıyor.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-5 py-3">Önem</th>
                  <th className="px-5 py-3">Hata Kodu & Açıklama</th>
                  <th className="px-5 py-3">Firma / Bağlam</th>
                  <th className="px-5 py-3 text-center">Tekrar</th>
                  <th className="px-5 py-3">İlk / Son Görülme</th>
                  <th className="px-5 py-3">Durum</th>
                  <th className="px-5 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {problems.map((prob) => {
                  const meta = PROBLEM_LABELS[prob.code] || { label: prob.code, desc: prob.code };
                  const isResolved = !!prob.resolvedAt;

                  return (
                    <tr
                      key={prob.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                        isResolved ? 'opacity-60 bg-slate-50/20 dark:bg-slate-900/20' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            prob.severity === 'error'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : prob.severity === 'warn'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {prob.severity.toUpperCase()}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">{meta.label}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm truncate">
                          {meta.desc}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {prob.companyKey || '—'}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {prob.occurrences}x
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                        <div>Son: {new Date(prob.lastSeenAt).toLocaleTimeString('tr-TR')}</div>
                        <div className="text-[10px] text-slate-400">
                          İlk: {new Date(prob.firstSeenAt).toLocaleDateString('tr-TR')}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            Çözüldü ({prob.resolvedBy || 'Kullanıcı'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <ExclamationCircleIcon className="h-3.5 w-3.5" />
                            Açık
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {prob.detail && (
                            <button
                              onClick={() => setInspectProblem(prob)}
                              title="Detayı Görüntüle"
                              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                          )}
                          {!isResolved && (
                            <button
                              onClick={() => handleResolve(prob.id)}
                              disabled={resolvingId === prob.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                            >
                              {resolvingId === prob.id ? (
                                <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                              )}
                              Çözüldü
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Detail Modal */}
      {inspectProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-scale-in">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ExclamationCircleIcon className="h-5 w-5 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Problem Detayı: {inspectProblem.code}
                </h2>
              </div>
              <button
                onClick={() => setInspectProblem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </header>

            <div className="p-6 space-y-3 overflow-y-auto">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Tekrar: <strong>{inspectProblem.occurrences} kez</strong> · Son Görülme:{' '}
                {new Date(inspectProblem.lastSeenAt).toLocaleString('tr-TR')}
              </div>
              <pre className="rounded-xl bg-slate-950 p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto select-all">
                {JSON.stringify(inspectProblem.detail, null, 2)}
              </pre>
            </div>

            <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-6 py-3 flex justify-end">
              <button
                onClick={() => setInspectProblem(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
              >
                Kapat
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
