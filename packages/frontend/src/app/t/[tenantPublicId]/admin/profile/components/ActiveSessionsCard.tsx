'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, ComputerDesktopIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface SessionRow {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  isCurrent: boolean;
}

/** Kendi aktif oturumlari; mevcut isaretli ve kapatilamaz (backend zaten current'i haric tutar). */
export function ActiveSessionsCard() {
  const t = useTranslations('profile.sessions');
  const toast = useToast();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<SessionRow[]>('/api/system/sessions'));
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id: string) => {
    setBusy(id);
    try {
      await apiFetch(`/api/system/sessions/${id}`, { method: 'DELETE' });
      toast.success(t('revoked'));
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    setBusy('all');
    try {
      const r = await apiFetch<{ revoked: number }>('/api/system/sessions', { method: 'DELETE' });
      toast.success(t('revokedOthers', { count: r.revoked }));
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : '—');
  const others = rows.filter((r) => !r.isCurrent).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{t('title')}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="rounded-kp-md border border-kp-border px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary">
            <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={revokeOthers} disabled={others === 0 || busy !== null} className="rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 px-3 py-1.5 text-xs font-semibold text-kp-danger disabled:opacity-40">
            {t('revokeOthers')}
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-kp-danger">{error}</p>
      ) : isLoading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 rounded-kp-md bg-kp-bg-tertiary animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-kp-text-tertiary">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <ComputerDesktopIcon className="h-5 w-5 text-kp-text-tertiary flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-kp-text-primary truncate">
                    {s.deviceInfo || t('unknownDevice')}
                    {s.isCurrent && <span className="ml-2 rounded-kp-sm bg-kp-success/15 px-1.5 py-0.5 text-[0.625rem] font-semibold text-kp-success">{t('current')}</span>}
                  </div>
                  <div className="text-[0.6875rem] text-kp-text-tertiary">
                    {s.ipAddress || '—'} · {t('lastUsed')}: {fmt(s.lastUsedAt ?? s.createdAt)}
                  </div>
                </div>
              </div>
              {/* Mevcut oturum kapatilamaz: buton yok. */}
              {!s.isCurrent && (
                <button onClick={() => revoke(s.id)} disabled={busy !== null} title={t('revoke')} className="p-1 text-kp-text-tertiary hover:text-kp-danger disabled:opacity-40">
                  {busy === s.id ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <XMarkIcon className="h-4 w-4" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
