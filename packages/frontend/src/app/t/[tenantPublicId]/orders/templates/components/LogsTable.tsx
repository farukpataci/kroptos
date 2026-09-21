'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { useNotificationLogs, type LogRow, type LogStatus } from '../hooks/useNotificationLogs';
import { EVENT_ORDER } from './TemplatesTable';

const STATUS_CLASS: Record<LogStatus, string> = {
  QUEUED: 'bg-kp-info/10 text-kp-info border-kp-info/30',
  SENT: 'bg-kp-success/10 text-kp-success border-kp-success/30',
  DELIVERED: 'bg-kp-success/10 text-kp-success border-kp-success/30',
  FAILED: 'bg-kp-danger/10 text-kp-danger border-kp-danger/30',
  SKIPPED: 'bg-kp-warning/10 text-kp-warning border-kp-warning/30',
};

const selectCls = 'rounded-kp-md border border-kp-border bg-kp-bg-primary px-2 py-1.5 text-xs text-kp-text-primary';

export function StatusBadge({ status }: { status: LogStatus }) {
  const t = useTranslations('notificationTemplates.status');
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider ${STATUS_CLASS[status]}`}>{t(status)}</span>;
}

/** Gönderim günlüğü: sayfalı tablo, filtreler, satır detayı, FAILED/SKIPPED için tekrar dene. */
export default function LogsTable({ tenantPublicId }: { tenantPublicId: string }) {
  const t = useTranslations('notificationTemplates');
  const te = useTranslations('notificationTemplates.events');
  const tc = useTranslations('common');
  const toast = useToast();
  const { tenantContext } = useAuth();
  const logs = useNotificationLogs();
  const [open, setOpen] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const retry = async (row: LogRow) => {
    setBusyId(row.id);
    try {
      await logs.retry(row.id);
      toast.success(t('logs.retried'));
      await logs.refresh();
    } catch (e: any) {
      toast.error(e?.message || tc('unknownError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={logs.filters.channel} onChange={(e) => logs.updateFilters({ channel: e.target.value as any })} className={selectCls}>
          <option value="">{t('filters.allChannels')}</option>
          <option value="EMAIL">{t('channel.EMAIL')}</option>
          <option value="SMS">{t('channel.SMS')}</option>
        </select>
        <select value={logs.filters.status} onChange={(e) => logs.updateFilters({ status: e.target.value as any })} className={selectCls}>
          <option value="">{t('filters.allStatuses')}</option>
          {(['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED'] as LogStatus[]).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        <select value={logs.filters.event} onChange={(e) => logs.updateFilters({ event: e.target.value })} className={selectCls}>
          <option value="">{t('filters.allEvents')}</option>
          {EVENT_ORDER.map((ev) => <option key={ev} value={ev}>{te(ev)}</option>)}
        </select>
        <input type="date" value={logs.filters.from} onChange={(e) => logs.updateFilters({ from: e.target.value })} className={selectCls} />
        <input type="date" value={logs.filters.to} onChange={(e) => logs.updateFilters({ to: e.target.value })} className={selectCls} />
        <input value={logs.filters.orderId} onChange={(e) => logs.updateFilters({ orderId: e.target.value })} placeholder={t('filters.orderId')} className={`${selectCls} w-56 font-mono`} />
        <button type="button" onClick={logs.refresh} className="ml-auto flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3 py-1.5 text-xs font-semibold text-kp-text-secondary"><ArrowPathIcon className={`h-3.5 w-3.5 ${logs.isLoading ? 'animate-spin' : ''}`} /> {tc('actions.refresh')}</button>
      </div>

      {logs.error && <div className="rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3.5 py-2 text-xs text-kp-danger">{logs.error}</div>}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-kp-border bg-kp-bg-primary/40 text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">
              <tr>
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3">{t('logs.date')}</th>
                <th className="px-4 py-3">{t('logs.channel')}</th>
                <th className="px-4 py-3">{t('logs.event')}</th>
                <th className="px-4 py-3">{t('logs.order')}</th>
                <th className="px-4 py-3">{t('logs.recipient')}</th>
                <th className="px-4 py-3">{t('logs.status')}</th>
                <th className="px-4 py-3">{t('logs.provider')}</th>
                <th className="px-4 py-3 text-right">{t('logs.attempts')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {logs.items.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-kp-text-tertiary">{logs.isLoading ? '…' : t('logs.empty')}</td></tr>
              ) : logs.items.map((row) => (
                <LogRowView key={row.id} row={row} open={open === row.id} onToggle={() => setOpen(open === row.id ? null : row.id)} onRetry={() => retry(row)} busy={busyId === row.id} tenantPublicId={tenantPublicId} storeId={tenantContext.storeId} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-kp-border px-4 py-2 text-[0.6875rem] text-kp-text-tertiary">
          <span>{t('logs.total', { count: logs.total })}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={logs.page <= 1} onClick={() => logs.setPage(logs.page - 1)} className="rounded-kp-md border border-kp-border px-2 py-1 disabled:opacity-40">‹</button>
            <span>{logs.page} / {logs.pageCount}</span>
            <button type="button" disabled={logs.page >= logs.pageCount} onClick={() => logs.setPage(logs.page + 1)} className="rounded-kp-md border border-kp-border px-2 py-1 disabled:opacity-40">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogRowView({ row, open, onToggle, onRetry, busy, tenantPublicId }: { row: LogRow; open: boolean; onToggle: () => void; onRetry: () => void; busy: boolean; tenantPublicId: string; storeId: string | null }) {
  const t = useTranslations('notificationTemplates');
  const te = useTranslations('notificationTemplates.events');
  return (
    <>
      <tr className="transition-colors hover:bg-kp-bg-hover/30">
        <td className="px-2 py-3"><button type="button" onClick={onToggle} className="text-kp-text-tertiary">{open ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}</button></td>
        <td className="whitespace-nowrap px-4 py-3 text-kp-text-secondary">{new Date(row.createdAt).toLocaleString('tr-TR')}</td>
        <td className="px-4 py-3">{t(`channel.${row.channel}`)}{row.isTest && <span className="ml-1 rounded border border-kp-border px-1 text-[0.625rem] uppercase text-kp-text-tertiary">test</span>}</td>
        <td className="px-4 py-3 text-kp-text-secondary">{te(row.event)}</td>
        <td className="px-4 py-3 font-mono">{row.orderId ? <Link href={`/t/${tenantPublicId}/orders?orderId=${row.orderId}`} className="text-kp-accent hover:underline">{row.orderId.slice(-8)}</Link> : '—'}</td>
        <td className="px-4 py-3 font-mono text-kp-text-secondary">{row.recipient}</td>
        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
        <td className="px-4 py-3 text-kp-text-secondary">{row.provider}</td>
        <td className="px-4 py-3 text-right tabular-nums">{row.attempts}</td>
        <td className="px-4 py-3 text-right">
          {(row.status === 'FAILED' || row.status === 'SKIPPED') && row.orderId && (
            <button type="button" onClick={onRetry} disabled={busy} className="flex items-center gap-1 text-xs font-semibold text-kp-accent hover:underline disabled:opacity-50"><ArrowPathIcon className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> {t('logs.retry')}</button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-kp-bg-primary/30">
          <td colSpan={10} className="px-6 py-4">
            <div className="grid gap-3 text-xs md:grid-cols-[1fr_2fr]">
              <dl className="space-y-1 text-kp-text-secondary">
                {row.subject && <><dt className="font-bold uppercase text-[0.625rem] text-kp-text-tertiary">{t('editor.subject')}</dt><dd>{row.subject}</dd></>}
                {row.template && <><dt className="font-bold uppercase text-[0.625rem] text-kp-text-tertiary">{t('logs.template')}</dt><dd>{row.template.name} ({row.template.scopeLevel})</dd></>}
                {row.providerMessageId && <><dt className="font-bold uppercase text-[0.625rem] text-kp-text-tertiary">{t('logs.messageId')}</dt><dd className="font-mono">{row.providerMessageId}</dd></>}
                {row.sentAt && <><dt className="font-bold uppercase text-[0.625rem] text-kp-text-tertiary">{t('logs.sentAt')}</dt><dd>{new Date(row.sentAt).toLocaleString('tr-TR')}</dd></>}
                {row.errorMessage && <><dt className="font-bold uppercase text-[0.625rem] text-kp-danger">{t('logs.error')}</dt><dd className="text-kp-danger">{row.errorMessage}</dd></>}
              </dl>
              {row.channel === 'EMAIL' && row.renderedBody ? (
                <iframe title="body" sandbox="" srcDoc={row.renderedBody} className="h-72 w-full rounded-kp-md border border-kp-border bg-white" />
              ) : (
                <pre className="whitespace-pre-wrap rounded-kp-md border border-kp-border bg-kp-bg-primary p-3 font-mono text-kp-text-secondary">{row.renderedBody || '—'}</pre>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
