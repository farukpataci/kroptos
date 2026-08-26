'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

/** KroptOS product fields an uploaded column can be mapped onto. */
const TARGET_FIELDS = ['sku', 'name', 'barcode', 'price', 'stockQuantity', 'categoryId', 'ignore'] as const;

const STEPS = ['upload', 'mapping', 'review'] as const;
type Step = (typeof STEPS)[number];

export default function ImportWizard() {
  const t = useTranslations('productTransfer');

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  /** Columns read from the picked file. Empty until a parser exists. */
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const stepIndex = STEPS.indexOf(step);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    // TODO(backend): POST /api/products/import/parse — dosyayı sunucu okumalı.
    // Tarayıcıda CSV/XLSX ayrıştırmıyoruz: kolon listesi uydurmak, eşleme
    // ekranını gerçek veriyle çalışıyormuş gibi gösterirdi.
    setColumns([]);
    setMapping({});
  };

  const selectClass =
    'w-full rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-none';

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <ol className="card flex items-center gap-2 p-4">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? 'bg-kp-accent text-white'
                    : done
                      ? 'bg-kp-success/15 text-kp-success'
                      : 'bg-kp-bg-hover text-kp-text-tertiary'
                }`}
              >
                {done ? <CheckCircleIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`truncate text-xs font-medium ${
                  active ? 'text-kp-text-primary' : 'text-kp-text-tertiary'
                }`}
              >
                {t(`import.steps.${s}`)}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-kp-border" />}
            </li>
          );
        })}
      </ol>

      {step === 'upload' && (
        <div className="card space-y-4 p-6">
          <label
            htmlFor="import-file"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-kp-md border border-dashed border-kp-border bg-kp-bg-primary/40 px-6 py-10 text-center transition-all hover:border-kp-accent"
          >
            <ArrowUpTrayIcon className="h-8 w-8 text-kp-text-tertiary" />
            <span className="text-sm font-semibold text-kp-text-primary">
              {fileName || t('import.dropzone')}
            </span>
            <span className="text-xs text-kp-text-tertiary">{t('import.dropzoneHint')}</span>
            <input
              id="import-file"
              type="file"
              accept=".csv,.xlsx,.xml"
              onChange={handleFile}
              className="hidden"
            />
          </label>

          {/* TODO(backend): GET /api/products/import/template — şablon dosyası
              sunucudan gelmeli. Sahte bir indirme linki vermiyoruz. */}
          <button
            type="button"
            disabled
            title={t('notWired')}
            className="flex cursor-not-allowed items-center gap-2 text-xs font-semibold text-kp-text-tertiary opacity-60"
          >
            <DocumentTextIcon className="h-4 w-4" />
            {t('import.downloadTemplate')}
          </button>
        </div>
      )}

      {step === 'mapping' && (
        <div className="card overflow-hidden p-0">
          {columns.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center p-8 text-center">
              <p className="max-w-sm text-xs text-kp-text-tertiary">{t('import.noColumns')}</p>
            </div>
          ) : (
            <table className="kp-table w-full">
              <thead>
                <tr>
                  <th>{t('import.fileColumn')}</th>
                  <th>{t('import.targetField')}</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col}>
                    <td className="font-mono text-kp-text-secondary">{col}</td>
                    <td>
                      <select
                        value={mapping[col] || 'ignore'}
                        aria-label={col}
                        onChange={(e) => setMapping({ ...mapping, [col]: e.target.value })}
                        className={selectClass}
                      >
                        {TARGET_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {t(`import.fields.${f}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="card space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-kp-md border border-kp-border bg-kp-bg-primary/40 p-4 text-center">
              <p className="text-[0.625rem] uppercase tracking-wide text-kp-text-tertiary">
                {t('import.validRows')}
              </p>
              <p className="text-lg font-semibold text-kp-success">0</p>
            </div>
            <div className="rounded-kp-md border border-kp-border bg-kp-bg-primary/40 p-4 text-center">
              <p className="text-[0.625rem] uppercase tracking-wide text-kp-text-tertiary">
                {t('import.invalidRows')}
              </p>
              <p className="text-lg font-semibold text-kp-danger">0</p>
            </div>
          </div>
          <p className="rounded-kp-md border border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-xs text-kp-text-tertiary">
            {t('notWired')}
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)])}
          disabled={stepIndex === 0}
          className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-all hover:bg-kp-bg-hover disabled:opacity-40"
        >
          {t('import.previous')}
        </button>
        {stepIndex < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(STEPS[stepIndex + 1])}
            disabled={stepIndex === 0 && !fileName}
            className="rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-kp-accent-hover disabled:opacity-40"
          >
            {t('import.next')}
          </button>
        ) : (
          // TODO(backend): POST /api/products/import — devreye alınacak uç.
          <button
            type="button"
            disabled
            title={t('notWired')}
            className="cursor-not-allowed rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white opacity-50"
          >
            {t('import.submit')}
          </button>
        )}
      </div>
    </div>
  );
}
