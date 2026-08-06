'use client';

import { useTranslations } from 'next-intl';
import { FieldShell, FieldProps, errorInputClass, inputClass } from './FieldShell';
import { optionLabel, useOptionSource } from './useOptionSource';

/**
 * A select whose options come from the API rather than the manifest. Used for
 * anything tenant-owned — warehouses, price lists, ERP integrations, a
 * marketplace's own shipment addresses.
 */
export function ResourceSelectField({
  field,
  value,
  error,
  disabled,
  onChange,
}: FieldProps<string>) {
  const t = useTranslations();
  const { options, isLoading, error: loadError } = useOptionSource(field.optionsSource);

  const merged = field.options ? [...field.options, ...options] : options;
  const isMissing = value && !merged.some((option) => option.value === value);

  return (
    <FieldShell field={field} error={error} htmlFor={field.key}>
      <select
        id={field.key}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled || field.readOnly || isLoading}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${error ? errorInputClass : ''}`}
      >
        <option value="">
          {isLoading
            ? t('integrations.settings.actions.loading')
            : t('integrations.settings.actions.choose')}
        </option>
        {/* A stored id whose record is gone would otherwise silently reset the
            field to blank on the next save. Showing it keeps the loss visible. */}
        {isMissing && (
          <option value={value as string}>
            {t('integrations.settings.actions.unknownResource', { id: value as string })}
          </option>
        )}
        {merged.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {optionLabel(option.labelKey, t)}
          </option>
        ))}
      </select>

      {Boolean(loadError) && (
        <p className="mt-1.5 text-[0.6875rem] text-kp-warning">
          {t('integrations.settings.actions.optionsUnavailable')}
        </p>
      )}
    </FieldShell>
  );
}
