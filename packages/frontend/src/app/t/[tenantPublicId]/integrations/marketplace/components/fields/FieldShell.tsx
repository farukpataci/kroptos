'use client';

import type { ReactNode } from 'react';
import type { SettingsField } from '@kroptos/shared';
import { useTranslations } from 'next-intl';

export interface FieldProps<T = unknown> {
  field: SettingsField;
  value: T;
  error?: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}

export const inputClass =
  'w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3.5 py-2 text-xs text-kp-text-primary transition-colors focus:outline-hidden focus:border-kp-accent disabled:opacity-50 disabled:cursor-not-allowed';

export const errorInputClass = 'border-kp-danger focus:border-kp-danger';

/**
 * Label, unit, help text, badge and error message for one field. Every field
 * component wraps its control in this so the grid stays aligned no matter which
 * control the manifest asked for.
 */
export function FieldShell({
  field,
  error,
  children,
  htmlFor,
}: {
  field: SettingsField;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  const t = useTranslations();

  return (
    <div className={field.colSpan === 2 ? 'md:col-span-2' : undefined}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary"
        >
          {t(field.labelKey)}
          {field.required && <span className="ml-1 text-kp-danger">*</span>}
        </label>
        {field.badgeKey && (
          <span className="rounded-kp-md border border-kp-border bg-kp-bg-tertiary px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wide text-kp-text-tertiary">
            {t(`integrations.settings.badges.${field.badgeKey}`)}
          </span>
        )}
      </div>

      {children}

      {field.helpKey && !error && (
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-kp-text-tertiary">{t(field.helpKey)}</p>
      )}
      {error && <p className="mt-1.5 text-[0.6875rem] font-semibold text-kp-danger">{error}</p>}
    </div>
  );
}

/** Trailing unit chip (adet, dakika, %, …) rendered inside numeric inputs. */
export function UnitSuffix({ unitKey }: { unitKey?: string }) {
  const t = useTranslations();
  if (!unitKey) return null;
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.625rem] font-semibold uppercase text-kp-text-tertiary">
      {t(unitKey)}
    </span>
  );
}
