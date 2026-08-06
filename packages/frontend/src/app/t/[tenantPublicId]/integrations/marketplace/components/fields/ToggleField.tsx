'use client';

import { useTranslations } from 'next-intl';

import type { FieldProps } from './FieldShell';

export function ToggleField({ field, value, error, disabled, onChange }: FieldProps<boolean>) {
  const t = useTranslations();
  const checked = value === true;

  return (
    <div className={field.colSpan === 2 ? 'md:col-span-2' : undefined}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled || field.readOnly}
        onClick={() => onChange(!checked)}
        className="flex w-full items-start gap-3 rounded-kp-md border border-kp-border bg-kp-bg-primary px-3.5 py-3 text-left transition-colors hover:bg-kp-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={`mt-0.5 flex h-4.5 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            checked ? 'bg-kp-accent' : 'bg-kp-bg-tertiary border border-kp-border'
          }`}
        >
          <span
            className={`h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
              checked ? 'translate-x-3.5' : 'translate-x-0'
            }`}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-kp-text-primary">
            {t(field.labelKey)}
            {field.required && <span className="ml-1 text-kp-danger">*</span>}
          </span>
          {field.helpKey && (
            <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-kp-text-tertiary">
              {t(field.helpKey)}
            </span>
          )}
        </span>
      </button>
      {error && <p className="mt-1.5 text-[0.6875rem] font-semibold text-kp-danger">{error}</p>}
    </div>
  );
}
