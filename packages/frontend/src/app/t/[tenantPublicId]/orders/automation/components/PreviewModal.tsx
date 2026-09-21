'use client';

import { useTranslations } from 'next-intl';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { AutomationRule, PreviewResult } from '../hooks/useOrderAutomation';

interface PreviewModalProps {
  rule: AutomationRule;
  result: PreviewResult | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

/**
 * Kuralın şu an hangi siparişlere dokunacağı — hiçbir şey yazmadan.
 *
 * Durum değiştiren bir kural uygulandıktan sonra geri alınamıyor; "çalıştır"
 * düğmesine basmadan önce kapsamın görülebildiği tek yer burası.
 */
export default function PreviewModal({
  rule,
  result,
  isLoading,
  error,
  onClose,
}: PreviewModalProps) {
  const t = useTranslations('orderAutomation');
  const tc = useTranslations('common');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100 dark:bg-slate-800-secondary/80 backdrop-blur-sm p-4">
      <div className="card max-h-[80vh] w-full max-w-2xl overflow-y-auto p-0 animate-fade-in">
        <div className="flex items-center justify-between border-b border-kp-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-kp-text-primary">
              {t('preview.title')}
            </h2>
            <p className="mt-0.5 truncate text-xs text-kp-text-tertiary">{rule.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-kp-sm p-1.5 text-kp-text-tertiary transition-colors hover:bg-slate-100 dark:bg-slate-800-hover hover:text-kp-text-primary"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5">
          {isLoading ? (
            <p className="py-10 text-center text-xs text-kp-text-tertiary">{tc('loading')}</p>
          ) : error ? (
            <div className="rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3 py-2 text-xs text-kp-danger">
              {error}
            </div>
          ) : result ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-kp-md border border-kp-border px-3 py-2.5">
                  <p className="text-[0.6875rem] uppercase tracking-wider text-kp-text-tertiary">
                    {t('preview.matched')}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-kp-accent">{result.matched}</p>
                </div>
                <div className="rounded-kp-md border border-kp-border px-3 py-2.5">
                  <p className="text-[0.6875rem] uppercase tracking-wider text-kp-text-tertiary">
                    {t('preview.scanned')}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-kp-text-primary">
                    {result.scanned}
                  </p>
                </div>
              </div>

              {result.samples.length === 0 ? (
                <p className="py-8 text-center text-xs text-kp-text-tertiary">
                  {t('preview.noMatch')}
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs font-semibold text-kp-text-secondary">
                    {t('preview.samples')}
                  </p>
                  <div className="overflow-x-auto rounded-kp-md border border-kp-border">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-kp-border bg-slate-100 dark:bg-slate-800-primary/40 text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">
                        <tr>
                          <th className="px-3 py-2">{t('preview.orderNumber')}</th>
                          <th className="px-3 py-2">{t('preview.customer')}</th>
                          <th className="px-3 py-2">{t('fields.status')}</th>
                          <th className="px-3 py-2">{t('fields.total')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-kp-border">
                        {result.samples.map((row) => (
                          <tr key={row.id}>
                            <td className="px-3 py-2.5 font-mono text-kp-accent">
                              {row.orderNumber}
                            </td>
                            <td className="px-3 py-2.5 text-kp-text-primary">
                              {row.customerName}
                            </td>
                            <td className="px-3 py-2.5 text-kp-text-secondary">
                              {t(`orderStatus.${row.status}`)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-kp-text-secondary">
                              {row.totalAmount} {row.currency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.matched > result.samples.length && (
                    <p className="mt-2 text-[0.6875rem] text-kp-text-tertiary">
                      {t('preview.more', { count: result.matched - result.samples.length })}
                    </p>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
