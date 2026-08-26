'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const EXPORT_COLUMNS = [
  'sku',
  'name',
  'barcode',
  'price',
  'costPrice',
  'stockQuantity',
  'category',
  'status',
  'createdAt',
] as const;

const FORMATS = ['CSV', 'XLSX', 'XML'] as const;

export default function ExportPanel() {
  const t = useTranslations('productTransfer');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('all');
  const [format, setFormat] = useState<string>('CSV');
  const [columns, setColumns] = useState<string[]>(['sku', 'name', 'price', 'stockQuantity']);

  const toggleColumn = (c: string) =>
    setColumns((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const fieldClass =
    'w-full rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="export-from" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('export.from')}
            </label>
            {/* Native date input: a picker library would be a dependency for
                something the platform already ships. */}
            <input
              id="export-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="export-to" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('export.to')}
            </label>
            <input
              id="export-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="export-status" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('export.status')}
            </label>
            <select
              id="export-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={fieldClass}
            >
              <option value="all">{t('export.allStatuses')}</option>
              <option value="active">{t('export.statusActive')}</option>
              <option value="passive">{t('export.statusPassive')}</option>
            </select>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-kp-text-secondary">{t('export.columns')}</p>
          <div className="flex flex-wrap gap-2">
            {EXPORT_COLUMNS.map((c) => (
              <label
                key={c}
                className="flex cursor-pointer items-center gap-2 rounded-kp-md border border-kp-border px-3 py-1.5 text-xs text-kp-text-secondary"
              >
                <input
                  type="checkbox"
                  checked={columns.includes(c)}
                  onChange={() => toggleColumn(c)}
                  className="h-3.5 w-3.5 rounded border-kp-border accent-kp-accent"
                />
                {t(`export.column.${c}`)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[160px]">
            <label htmlFor="export-format" className="mb-1 block text-xs font-medium text-kp-text-secondary">
              {t('export.format')}
            </label>
            <select
              id="export-format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className={fieldClass}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* TODO(backend): GET /api/products/export — dosyayı sunucu üretmeli. */}
          <button
            type="button"
            disabled
            title={t('notWired')}
            className="flex cursor-not-allowed items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {t('export.submit')}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="border-b border-kp-border px-5 py-3">
          <h3 className="text-xs font-semibold text-kp-text-primary">{t('export.history')}</h3>
        </div>
        {/* TODO(backend): GET /api/products/export/history — kayıt tutulmuyor. */}
        <div className="flex min-h-[160px] items-center justify-center p-8 text-center">
          <p className="max-w-sm text-xs text-kp-text-tertiary">{t('export.historyEmpty')}</p>
        </div>
      </div>
    </div>
  );
}
