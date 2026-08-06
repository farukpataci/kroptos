'use client';

import { useTranslations } from 'next-intl';
import { CheckIcon } from '@heroicons/react/24/outline';
import { FieldShell, FieldProps } from './FieldShell';

export function MultiSelectField({ field, value, error, disabled, onChange }: FieldProps<string[]>) {
  const t = useTranslations();
  const selected = Array.isArray(value) ? value : [];

  const toggle = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((entry) => entry !== option)
        : [...selected, option],
    );
  };

  return (
    <FieldShell field={field} error={error}>
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled || field.readOnly || option.disabled}
              onClick={() => toggle(option.value)}
              className={`flex items-center gap-1.5 rounded-kp-md border px-2.5 py-1.5 text-[0.6875rem] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? 'border-kp-accent bg-kp-accent/10 text-kp-accent'
                  : 'border-kp-border bg-kp-bg-primary text-kp-text-secondary hover:border-kp-accent hover:text-kp-accent'
              }`}
            >
              {isSelected && <CheckIcon className="h-3 w-3" />}
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}
