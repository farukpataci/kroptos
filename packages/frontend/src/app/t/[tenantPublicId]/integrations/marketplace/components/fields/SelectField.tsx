'use client';

import { useTranslations } from 'next-intl';
import { FieldShell, FieldProps, errorInputClass, inputClass } from './FieldShell';

export function SelectField({ field, value, error, disabled, onChange }: FieldProps<string>) {
  const t = useTranslations();

  return (
    <FieldShell field={field} error={error} htmlFor={field.key}>
      <select
        id={field.key}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled || field.readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${error ? errorInputClass : ''}`}
      >
        <option value="">{t('integrations.settings.actions.choose')}</option>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
