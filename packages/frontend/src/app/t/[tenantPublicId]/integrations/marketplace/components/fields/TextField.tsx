'use client';

import { useTranslations } from 'next-intl';
import { FieldShell, FieldProps, errorInputClass, inputClass } from './FieldShell';

export function TextField({ field, value, error, disabled, onChange }: FieldProps<string>) {
  const t = useTranslations();

  return (
    <FieldShell field={field} error={error} htmlFor={field.key}>
      <input
        id={field.key}
        type="text"
        value={typeof value === 'string' ? value : ''}
        maxLength={field.maxLength}
        readOnly={field.readOnly}
        disabled={disabled}
        placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${error ? errorInputClass : ''}`}
      />
    </FieldShell>
  );
}

export function TextareaField({ field, value, error, disabled, onChange }: FieldProps<string>) {
  const t = useTranslations();

  return (
    <FieldShell field={field} error={error} htmlFor={field.key}>
      <textarea
        id={field.key}
        rows={4}
        value={typeof value === 'string' ? value : ''}
        maxLength={field.maxLength}
        readOnly={field.readOnly}
        disabled={disabled}
        placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} resize-y ${error ? errorInputClass : ''}`}
      />
    </FieldShell>
  );
}
