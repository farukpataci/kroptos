'use client';

import { useTranslations } from 'next-intl';
import { FieldShell, FieldProps } from './FieldShell';

export function RadioGroupField({ field, value, error, disabled, onChange }: FieldProps<string>) {
  const t = useTranslations();
  const options = field.options ?? [];

  return (
    <FieldShell field={field} error={error}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled || field.readOnly || option.disabled}
              onClick={() => onChange(option.value)}
              className={`flex items-start gap-2.5 rounded-kp-md border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? 'border-kp-accent bg-kp-accent/5 ring-1 ring-kp-accent'
                  : 'border-kp-border bg-kp-bg-primary hover:border-kp-accent/50'
              }`}
            >
              <span
                className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected ? 'border-kp-accent' : 'border-kp-border'
                }`}
              >
                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-kp-accent" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.6875rem] font-bold text-kp-text-primary">
                  {t(option.labelKey)}
                </span>
                {option.descriptionKey && (
                  <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-kp-text-tertiary">
                    {t(option.descriptionKey)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}
