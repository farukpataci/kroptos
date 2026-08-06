'use client';

import { useTranslations } from 'next-intl';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import type { SettingsFieldOption, SettingsOptionSource } from '@kroptos/shared';
import { FieldShell, FieldProps, inputClass } from './FieldShell';
import { optionLabel, useOptionSource } from './useOptionSource';

type Mapping = Record<string, string>;

const isRemote = (
  source: SettingsOptionSource | SettingsFieldOption[],
): source is SettingsOptionSource => !Array.isArray(source);

/**
 * Two-column mapping: each value the marketplace uses on the left, the KroptOS
 * value it maps to on the right. Either side may be a static option list or a
 * remote collection.
 */
export function MappingTableField({ field, value, error, disabled, onChange }: FieldProps<Mapping>) {
  const t = useTranslations();
  const mapping = field.mapping;

  const leftRemote = useOptionSource(
    mapping && isRemote(mapping.leftSource) ? mapping.leftSource : undefined,
  );
  const rightRemote = useOptionSource(
    mapping && isRemote(mapping.rightSource) ? mapping.rightSource : undefined,
  );

  if (!mapping) return null;

  const leftOptions = isRemote(mapping.leftSource) ? leftRemote.options : mapping.leftSource;
  const rightOptions = isRemote(mapping.rightSource) ? rightRemote.options : mapping.rightSource;
  const pairs = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return (
    <FieldShell field={field} error={error}>
      <div className="overflow-hidden rounded-kp-md border border-kp-border">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-kp-border bg-kp-bg-primary/40 px-3 py-2 text-[0.625rem] font-bold uppercase tracking-wider text-kp-text-tertiary">
          <span>{t(mapping.leftLabelKey)}</span>
          <span className="w-4" />
          <span>{t(mapping.rightLabelKey)}</span>
        </div>

        {leftOptions.length === 0 ? (
          <p className="px-3 py-4 text-[0.6875rem] text-kp-text-tertiary">
            {leftRemote.isLoading
              ? t('integrations.settings.actions.loading')
              : t('integrations.settings.actions.noMappingSource')}
          </p>
        ) : (
          leftOptions.map((left) => (
            <div
              key={left.value}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-kp-border/60 px-3 py-2 last:border-b-0"
            >
              <span className="truncate text-[0.6875rem] font-semibold text-kp-text-primary">
                {optionLabel(left.labelKey, t)}
              </span>
              <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-kp-text-tertiary" />
              <select
                value={pairs[left.value] ?? ''}
                disabled={disabled || field.readOnly}
                onChange={(e) => {
                  const next = { ...pairs };
                  if (e.target.value) next[left.value] = e.target.value;
                  else delete next[left.value];
                  onChange(next);
                }}
                className={`${inputClass} py-1.5`}
              >
                <option value="">{t('integrations.settings.actions.unmapped')}</option>
                {rightOptions.map((right) => (
                  <option key={right.value} value={right.value}>
                    {optionLabel(right.labelKey, t)}
                  </option>
                ))}
              </select>
            </div>
          ))
        )}
      </div>
    </FieldShell>
  );
}
