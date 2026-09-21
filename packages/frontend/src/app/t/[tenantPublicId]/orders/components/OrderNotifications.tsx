'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BellSlashIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { StatusBadge } from '../templates/components/LogsTable';
import type { LogRow } from '../templates/hooks/useNotificationLogs';

/** Sipariş detayı → Bildirimler sekmesi: bu siparişin e-posta/SMS günlüğü. */
export default function OrderNotifications({ orderId }: { orderId: string }) {
  const t = useTranslations('notificationTemplates');
  const te = useTranslations('notificationTemplates.events');
  const { can } = usePermission();
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!can('notification_log.read')) return;
    apiFetch<LogRow[]>(`/api/notification-logs/order/${orderId}`).then(setRows).catch((e) => setError(e?.message || 'error'));
  }, [orderId, can]);

  if (!can('notification_log.read')) return <p className="py-8 text-center text-xs text-kp-text-tertiary">{t('editor.readOnlyRole')}</p>;
  if (error) return <p className="py-8 text-center text-xs text-kp-danger">{error}</p>;
  if (!rows) return <p className="py-8 text-center text-xs text-kp-text-tertiary">…</p>;
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <BellSlashIcon className="h-8 w-8 text-kp-text-tertiary" />
        <p className="text-xs text-kp-text-tertiary">{t('logs.empty')}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-kp-border">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
          <div className="min-w-0">
            <div className="font-semibold text-kp-text-primary">{te(r.event)} <span className="font-normal text-kp-text-tertiary">· {t(`channel.${r.channel}`)}{r.isTest ? ' · test' : ''}</span></div>
            <div className="truncate font-mono text-[0.6875rem] text-kp-text-tertiary">{r.recipient} · {new Date(r.createdAt).toLocaleString('tr-TR')}{r.errorMessage ? ` · ${r.errorMessage}` : ''}</div>
          </div>
          <StatusBadge status={r.status} />
        </li>
      ))}
    </ul>
  );
}
