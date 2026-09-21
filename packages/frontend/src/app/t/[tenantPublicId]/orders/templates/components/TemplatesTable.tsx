'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { EnvelopeIcon, DevicePhoneMobileIcon, PencilSquareIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import type { Channel, ScopeLevel, TemplateRow } from '../hooks/useNotificationTemplates';

export const EVENT_ORDER = [
  'ORDER_CREATED', 'ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_OUT_FOR_DELIVERY', 'ORDER_DELIVERED', 'ORDER_CANCELLED',
  'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'COD_REMINDER',
  'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_RECEIVED', 'REFUND_COMPLETED', 'INVOICE_CREATED', 'ORDER_STATUS_CHANGED',
];

const LEVEL_CLASS: Record<ScopeLevel, string> = {
  SYSTEM: 'bg-kp-bg-primary text-kp-text-tertiary border-kp-border',
  AGENCY: 'bg-kp-info/10 text-kp-info border-kp-info/30',
  CLIENT: 'bg-kp-accent/10 text-kp-accent border-kp-accent/30',
  STORE: 'bg-kp-success/10 text-kp-success border-kp-success/30',
};

export function LevelBadge({ level }: { level: ScopeLevel }) {
  const t = useTranslations('notificationTemplates.level');
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider ${LEVEL_CLASS[level]}`}>{t(level)}</span>;
}

interface Props {
  items: TemplateRow[];
  isLoading: boolean;
  canEdit: boolean;
  canCreate: boolean;
  onOpen: (row: TemplateRow) => void;
  onToggle: (row: TemplateRow) => void;
}

/** Event'e göre gruplu tablo; her event satırında E-posta ve SMS hücresi. */
export default function TemplatesTable({ items, isLoading, canEdit, canCreate, onOpen, onToggle }: Props) {
  const t = useTranslations('notificationTemplates');
  const te = useTranslations('notificationTemplates.events');

  const groups = useMemo(() => {
    const map = new Map<string, { event: string; orderStatusKey: string; cells: Partial<Record<Channel, TemplateRow>> }>();
    for (const row of items) {
      const key = `${row.event}:${row.orderStatusKey}`;
      if (!map.has(key)) map.set(key, { event: row.event, orderStatusKey: row.orderStatusKey, cells: {} });
      map.get(key)!.cells[row.channel] = row;
    }
    return [...map.values()].sort((a, b) => EVENT_ORDER.indexOf(a.event) - EVENT_ORDER.indexOf(b.event) || a.orderStatusKey.localeCompare(b.orderStatusKey));
  }, [items]);

  const cell = (row?: TemplateRow) => {
    if (!row) return <td className="px-4 py-3 text-kp-text-tertiary">—</td>;
    const dateText = row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('tr-TR') : t('table.never');
    return (
      <td className="px-4 py-3 align-top">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onOpen(row)} className="truncate text-left font-semibold text-kp-text-primary hover:text-kp-accent">{row.name}</button>
              <LevelBadge level={row.resolvedFrom} />
            </div>
            {row.subject && <div className="mt-0.5 truncate text-[0.6875rem] text-kp-text-tertiary">{row.subject}</div>}
            <div className="mt-1 text-[0.625rem] text-kp-text-tertiary">
              {t('table.updated')}: {dateText}
              {row.sendDelayMinutes > 0 && ` · ${t('table.delay', { minutes: row.sendDelayMinutes })}`}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={row.isActive}
              disabled={!canEdit || !row.editable}
              onClick={() => onToggle(row)}
              title={row.editable ? (row.isActive ? t('table.deactivate') : t('table.activate')) : t('table.toggleHint')}
              className={`relative h-5 w-9 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${row.isActive ? 'bg-kp-success' : 'bg-kp-border'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${row.isActive ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
            {row.editable && canEdit ? (
              <button type="button" onClick={() => onOpen(row)} title={t('table.edit')} className="text-kp-text-tertiary hover:text-kp-accent"><PencilSquareIcon className="h-4 w-4" /></button>
            ) : canCreate ? (
              <button type="button" onClick={() => onOpen(row)} title={t('table.customize')} className="text-kp-text-tertiary hover:text-kp-accent"><DocumentDuplicateIcon className="h-4 w-4" /></button>
            ) : null}
          </div>
        </div>
      </td>
    );
  };

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-kp-border bg-kp-bg-primary/40 text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">
            <tr>
              <th className="w-56 px-4 py-3">{t('table.event')}</th>
              <th className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><EnvelopeIcon className="h-3.5 w-3.5" /> {t('channel.EMAIL')}</span></th>
              <th className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><DevicePhoneMobileIcon className="h-3.5 w-3.5" /> {t('channel.SMS')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading && groups.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-kp-text-tertiary">…</td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-kp-text-tertiary">{t('table.empty')}</td></tr>
            ) : (
              groups.map((g) => (
                <tr key={`${g.event}:${g.orderStatusKey}`} className="transition-colors hover:bg-kp-bg-hover/30">
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-kp-text-primary">{te(g.event)}</div>
                    {g.orderStatusKey && <div className="mt-0.5 font-mono text-[0.6875rem] text-kp-text-tertiary">{g.orderStatusKey}</div>}
                    <div className="mt-0.5 font-mono text-[0.625rem] text-kp-text-tertiary">{g.event}</div>
                  </td>
                  {cell(g.cells.EMAIL)}
                  {cell(g.cells.SMS)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
