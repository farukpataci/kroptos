'use client';

import { useTranslations } from 'next-intl';
import { FieldShell, FieldProps } from './FieldShell';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function WeekdaysField({ field, value, error, disabled, onChange }: FieldProps<string[]>) {
  const t = useTranslations();
  const selected = Array.isArray(value) ? value : [];

  return (
    <FieldShell field={field} error={error}>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((day) => {
          const isSelected = selected.includes(day);
          return (
            <button
              key={day}
              type="button"
              disabled={disabled || field.readOnly}
              onClick={() =>
                onChange(
                  isSelected ? selected.filter((entry) => entry !== day) : [...selected, day],
                )
              }
              className={`h-9 w-11 rounded-kp-md border text-[0.6875rem] font-bold uppercase transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? 'border-kp-accent bg-kp-accent text-white'
                  : 'border-kp-border bg-kp-bg-primary text-kp-text-tertiary hover:border-kp-accent hover:text-kp-accent'
              }`}
            >
              {t(`integrations.settings.weekdays.${day}`)}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}
