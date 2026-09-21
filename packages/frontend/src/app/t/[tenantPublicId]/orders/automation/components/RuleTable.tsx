'use client';

import { useTranslations } from 'next-intl';
import {
  BoltIcon,
  EyeIcon,
  PencilSquareIcon,
  PlayIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import StatusBadge from '@/components/ui/StatusBadge';
import type { AutomationRule } from '../hooks/useOrderAutomation';

interface RuleTableProps {
  rules: AutomationRule[];
  isLoading: boolean;
  /** orders.automation.manage yoksa yazma düğmeleri hiç basılmaz. */
  canManage: boolean;
  busyRuleId: string | null;
  onEdit: (rule: AutomationRule) => void;
  onToggle: (rule: AutomationRule) => void;
  onPreview: (rule: AutomationRule) => void;
  onRun: (rule: AutomationRule) => void;
  onDelete: (rule: AutomationRule) => void;
  onCreate: () => void;
}

/** Koşul bloğunu tek satırlık okunur bir özete indirger. */
function summarizeConditions(
  rule: AutomationRule,
  t: ReturnType<typeof useTranslations>,
): string {
  const c = rule.conditions || {};
  const parts: string[] = [];

  if (c.source?.length) parts.push(`${t('fields.source')}: ${c.source.join(', ')}`);
  if (c.statusIn?.length) parts.push(`${t('fields.status')}: ${c.statusIn.join(', ')}`);
  if (c.paymentStatusIn?.length)
    parts.push(`${t('fields.paymentStatus')}: ${c.paymentStatusIn.join(', ')}`);
  if (c.fulfillmentStatusIn?.length)
    parts.push(`${t('fields.fulfillmentStatus')}: ${c.fulfillmentStatusIn.join(', ')}`);
  if (c.minTotal !== undefined || c.maxTotal !== undefined) {
    parts.push(
      `${t('fields.total')}: ${c.minTotal ?? '–'}–${c.maxTotal ?? '–'} ${c.currency ?? ''}`.trim(),
    );
  }
  if (c.cities?.length) parts.push(`${t('fields.city')}: ${c.cities.join(', ')}`);
  if (c.isPoolOrder !== undefined)
    parts.push(c.isPoolOrder ? t('fields.poolOnly') : t('fields.nonPoolOnly'));
  if (c.olderThanMinutes) parts.push(t('fields.waitedMinutes', { minutes: c.olderThanMinutes }));

  return parts.length ? parts.join(' · ') : t('fields.everyOrder');
}

function summarizeAction(
  rule: AutomationRule,
  t: ReturnType<typeof useTranslations>,
): string {
  const a = rule.action || { type: '' };
  const label = t(`actionTypes.${a.type}`);
  if (a.type === 'add_note') return `${label}: "${a.note ?? ''}"`;
  if (a.value) return `${label} → ${a.value}`;
  return label;
}

export default function RuleTable({
  rules,
  isLoading,
  canManage,
  busyRuleId,
  onEdit,
  onToggle,
  onPreview,
  onRun,
  onDelete,
  onCreate,
}: RuleTableProps) {
  const t = useTranslations('orderAutomation');
  const tc = useTranslations('common');

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-kp-border bg-kp-bg-primary/40 text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">
            <tr>
              <th className="px-4 py-3">{t('columns.priority')}</th>
              <th className="px-4 py-3">{t('columns.name')}</th>
              <th className="px-4 py-3">{t('columns.trigger')}</th>
              <th className="px-4 py-3">{t('columns.conditions')}</th>
              <th className="px-4 py-3">{t('columns.action')}</th>
              <th className="px-4 py-3">{t('columns.matchCount')}</th>
              <th className="px-4 py-3">{t('columns.lastRunAt')}</th>
              <th className="px-4 py-3">{t('columns.state')}</th>
              <th className="px-4 py-3 text-right">{t('columns.operations')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-kp-text-tertiary">
                  {tc('loading')}
                </td>
              </tr>
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <BoltIcon className="mx-auto h-8 w-8 text-kp-text-tertiary" />
                  <p className="mt-3 text-sm font-semibold text-kp-text-primary">
                    {t('empty.title')}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-kp-text-tertiary">
                    {t('empty.desc')}
                  </p>
                  {canManage && (
                    <button
                      type="button"
                      onClick={onCreate}
                      className="mt-4 rounded-kp-md bg-kp-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90"
                    >
                      {t('actions.newRule')}
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              rules.map((rule) => {
                const isBusy = busyRuleId === rule.id;
                return (
                  <tr key={rule.id} className="transition-colors hover:bg-kp-bg-hover/30">
                    <td className="px-4 py-3.5 font-mono text-kp-text-tertiary">{rule.priority}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-kp-text-primary">{rule.name}</p>
                      {rule.description && (
                        <p className="mt-0.5 max-w-xs truncate text-kp-text-tertiary">
                          {rule.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-kp-text-secondary">
                      {t(`triggers.${rule.trigger}`)}
                    </td>
                    <td className="max-w-xs px-4 py-3.5 text-kp-text-tertiary">
                      {summarizeConditions(rule, t)}
                    </td>
                    <td className="px-4 py-3.5 text-kp-text-secondary">
                      {summarizeAction(rule, t)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-kp-text-primary">
                      {rule.matchCount}
                    </td>
                    <td className="px-4 py-3.5 text-kp-text-tertiary">
                      {rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        status={rule.isActive ? 'active' : 'inactive'}
                        label={rule.isActive ? t('state.active') : t('state.paused')}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onPreview(rule)}
                          disabled={isBusy}
                          title={t('actions.preview')}
                          className="rounded-kp-sm p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-hover hover:text-kp-text-primary disabled:opacity-40"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => onRun(rule)}
                              disabled={isBusy || !rule.isActive}
                              title={
                                rule.isActive ? t('actions.runNow') : t('actions.runNeedsActive')
                              }
                              className="rounded-kp-sm p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-hover hover:text-kp-success disabled:opacity-40"
                            >
                              <PlayIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEdit(rule)}
                              disabled={isBusy}
                              title={tc('actions.edit')}
                              className="rounded-kp-sm p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-hover hover:text-kp-text-primary disabled:opacity-40"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggle(rule)}
                              disabled={isBusy}
                              className="rounded-kp-sm px-2 py-1 text-[0.6875rem] font-semibold text-kp-text-secondary transition-colors hover:bg-kp-bg-hover disabled:opacity-40"
                            >
                              {rule.isActive ? t('actions.pause') : t('actions.activate')}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(rule)}
                              disabled={isBusy}
                              title={tc('actions.delete')}
                              className="rounded-kp-sm p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-danger-muted hover:text-kp-danger disabled:opacity-40"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
