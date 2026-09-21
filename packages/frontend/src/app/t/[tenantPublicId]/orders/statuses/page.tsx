'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, ExclamationTriangleIcon, PlusIcon, QueueListIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/components/ui/Toast';
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

/**
 * Tenant-defined statuses. Stored in `TenantSettings.settings.orderStatuses`
 * (the JSON column the other settings forms already share) rather than a new
 * table: it is tenant-scoped, RLS-covered and served by the existing
 * GET/PUT /api/system/tenant-settings.
 */
interface CustomStatus {
  key: string;
  name: string;
  color: string;
}

const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#64748b', '#ec4899', '#14b8a6'];

const toKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export default function OrderStatusesPage() {
  const t = useTranslations('orderStatuses');
  const to = useTranslations('orders');
  const tc = useTranslations('common');
  const { tenantContext } = useAuth();
  const { can } = usePermission();
  const toast = useToast();

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tenantSettings, setTenantSettings] = useState<any>(null);
  const [custom, setCustom] = useState<CustomStatus[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CustomStatus>({ key: '', name: '', color: COLORS[0] });
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
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
      const [orders, settings] = await Promise.all([
        api.get<{ status: string }[]>('/api/orders', { signal: controller.signal }),
        api.get<any>('/api/system/tenant-settings', { signal: controller.signal }),
      ]);
      if (ticket !== latestRequest.current) return;
      setTenantSettings(settings);
      setCustom(Array.isArray(settings?.settings?.orderStatuses) ? settings.settings.orderStatuses : []);
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
    const known = new Set([...SYSTEM_STATUSES.map((s) => s.value), ...custom.map((c) => c.key)]);
    return Object.keys(counts)
      .filter((value) => !known.has(value))
      .sort();
  }, [counts, custom]);

  const rows = [
    ...SYSTEM_STATUSES.map((s) => ({ ...s, kind: 'system' as const, label: to(`status.${s.value}`), color: undefined })),
    ...custom.map((c) => ({ value: c.key, dotClass: '', color: c.color, kind: 'custom' as const, label: c.name })),
    ...unknown.map((value) => ({
      value,
      dotClass: 'bg-slate-400',
      color: undefined,
      kind: 'unknown' as const,
      label: value,
    })),
  ];

  // Whole-list PUT, same shape OrderSettingsForm uses: other keys of `settings` are kept.
  const saveCustom = async (next: CustomStatus[]) => {
    const payload = { settings: { ...(tenantSettings?.settings || {}), orderStatuses: next } };
    const saved = await api.put('/api/system/tenant-settings', payload);
    setTenantSettings(saved);
    setCustom(next);
  };

  const openCreate = () => {
    setForm({ key: '', name: '', color: COLORS[custom.length % COLORS.length] });
    setModalError(null);
    setCreateOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = toKey(form.key || form.name);
    const name = form.name.trim();
    if (!key || !name) return;
    const taken = SYSTEM_STATUSES.some((s) => s.value === key) || custom.some((c) => c.key === key);
    if (taken) {
      setModalError(t('keyTaken', { key }));
      return;
    }
    setBusy(true);
    setModalError(null);
    try {
      await saveCustom([...custom, { key, name, color: form.color }]);
      toast.success(t('created'));
      setCreateOpen(false);
    } catch (err: any) {
      setModalError(err?.message || tc('unknownError'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (key: string) => {
    setBusy(true);
    try {
      await saveCustom(custom.filter((c) => c.key !== key));
      toast.success(t('removed'));
    } catch (err: any) {
      toast.error(err?.message || tc('unknownError'));
    } finally {
      setBusy(false);
    }
  };

  const canManage = can('system.settings.manage');

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
        canManage && (
          <button
            type="button"
            onClick={openCreate}
            disabled={isLoading || !!error}
            className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-3 py-2 text-xs font-semibold text-white hover:bg-kp-accent-hover disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            {t('create')}
          </button>
        )
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
                {canManage && <th className="px-4 py-3 w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {rows.map((row) => (
                <tr key={row.value} className="transition-colors hover:bg-kp-bg-hover/30">
                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-2.5 font-semibold text-kp-text-primary">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dotClass}`} style={row.color ? { backgroundColor: row.color } : undefined} />
                      {row.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-kp-text-secondary">{row.value}</td>
                  <td className="px-4 py-3.5 text-kp-text-secondary">{t(`kind.${row.kind}`)}</td>
                  <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-kp-text-primary">
                    {isLoading ? '—' : counts[row.value] || 0}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3.5 text-right">
                      {row.kind === 'custom' && (
                        // A status with orders in it stays: deleting it would strand them under an undeclared value.
                        <button
                          type="button"
                          onClick={() => remove(row.value)}
                          disabled={busy || (counts[row.value] || 0) > 0}
                          title={(counts[row.value] || 0) > 0 ? t('removeBlocked') : tc('actions.delete')}
                          className="text-kp-text-tertiary hover:text-kp-danger disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {unknown.length > 0 && (
        <p className="text-xs text-kp-text-tertiary">{t('unknownNote', { count: unknown.length })}</p>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">{t('create')}</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-kp-text-tertiary hover:text-kp-text-primary"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submitCreate}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">{t('columns.name')}</label>
                  <input
                    autoFocus
                    required
                    maxLength={40}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">{t('columns.key')}</label>
                  <input
                    value={form.key}
                    placeholder={toKey(form.name)}
                    maxLength={40}
                    onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                    className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs font-mono text-kp-text-primary"
                  />
                  <p className="text-[0.6875rem] text-kp-text-tertiary">{t('keyHint')}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">{t('color')}</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        style={{ backgroundColor: c }}
                        className={`h-6 w-6 rounded-full border-2 ${form.color === c ? 'border-kp-text-primary' : 'border-transparent'}`}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </div>
                {modalError && (
                  <div className="flex items-start gap-2 p-3 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />{modalError}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-kp-border bg-kp-bg-primary/20 flex justify-end gap-3">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary">{tc('actions.cancel')}</button>
                <button type="submit" disabled={busy || !form.name.trim()} className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold disabled:opacity-50">
                  {busy && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}{tc('actions.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SubPageShell>
  );
}
