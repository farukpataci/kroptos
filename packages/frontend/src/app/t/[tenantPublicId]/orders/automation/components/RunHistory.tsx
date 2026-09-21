'use client';

import { useTranslations } from 'next-intl';
import StatusBadge from '@/components/ui/StatusBadge';
import type { AutomationRule, AutomationRun } from '../hooks/useOrderAutomation';

interface RunHistoryProps {
  runs: AutomationRun[];
  rules: AutomationRule[];
  isLoading: boolean;
}

/** Çalışma durumunu rozet tipine çevirir. */
function badgeType(status: AutomationRun['status']): string {
  switch (status) {
    case 'applied':
      return 'active';
    case 'skipped':
      return 'inactive';
    case 'failed':
      return 'error';
    default:
      return status;
  }
}

/**
 * Son çalışmalar.
 *
 * Atlanan satırlar da gösteriliyor: bir kuralın neden "hiçbir şey yapmadığı"
 * sorusunun cevabı burada — koşul tuttu ama sipariş zaten o durumdaydı.
 */
export default function RunHistory({ runs, rules, isLoading }: RunHistoryProps) {
  const t = useTranslations('orderAutomation');
  const tc = useTranslations('common');

  const ruleNames = new Map(rules.map((r) => [r.id, r.name]));

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-kp-border px-4 py-3">
        <h2 className="text-sm font-semibold text-kp-text-primary">{t('history.title')}</h2>
        <p className="mt-0.5 text-xs text-kp-text-tertiary">{t('history.subtitle')}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-kp-border bg-slate-100 dark:bg-slate-800-primary/40 text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">
            <tr>
              <th className="px-4 py-3">{t('history.when')}</th>
              <th className="px-4 py-3">{t('history.rule')}</th>
              <th className="px-4 py-3">{t('history.order')}</th>
              <th className="px-4 py-3">{t('history.result')}</th>
              <th className="px-4 py-3">{t('history.detail')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-xs text-kp-text-tertiary">
                  {tc('loading')}
                </td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-xs text-kp-text-tertiary">
                  {t('history.empty')}
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="transition-colors hover:bg-slate-100 dark:bg-slate-800-hover/30">
                  <td className="px-4 py-3 text-kp-text-tertiary">
                    {new Date(run.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-kp-text-primary">
                    {/* Kural silinmiş olabilir; satır denetim izi olarak kalır. */}
                    {ruleNames.get(run.ruleId) ?? t('history.deletedRule')}
                  </td>
                  <td className="px-4 py-3 font-mono text-kp-text-secondary">
                    {run.orderId.slice(0, 10)}…
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={badgeType(run.status)}
                      label={t(`history.status.${run.status}`)}
                    />
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-kp-text-tertiary">
                    {run.message ??
                      (run.appliedAction
                        ? `${t(`actionTypes.${run.appliedAction.type}`)}${
                            run.appliedAction.value ? ` → ${run.appliedAction.value}` : ''
                          }`
                        : '—')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
