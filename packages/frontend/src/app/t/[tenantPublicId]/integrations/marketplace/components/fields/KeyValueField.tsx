'use client';

import { useTranslations } from 'next-intl';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { FieldShell, FieldProps, inputClass } from './FieldShell';

type Pairs = Record<string, string>;

export function KeyValueField({ field, value, error, disabled, onChange }: FieldProps<Pairs>) {
  const t = useTranslations();
  const pairs = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const entries = Object.entries(pairs);
  const locked = disabled || field.readOnly;

  /**
   * Renaming a key rebuilds the whole object rather than deleting and
   * re-adding, so a half-typed key keeps its position in the list instead of
   * jumping to the end on every keystroke.
   */
  const renameKey = (index: number, nextKey: string) => {
    onChange(
      Object.fromEntries(entries.map(([key, val], i) => (i === index ? [nextKey, val] : [key, val]))),
    );
  };

  const setValue = (key: string, nextValue: string) => {
    onChange({ ...pairs, [key]: nextValue });
  };

  return (
    <FieldShell field={field} error={error}>
      <div className="space-y-2">
        {entries.map(([key, val], index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={key}
              disabled={locked}
              placeholder={t('integrations.settings.actions.keyPlaceholder')}
              onChange={(e) => renameKey(index, e.target.value)}
              className={`${inputClass} flex-1 font-mono`}
            />
            <input
              type="text"
              value={val}
              disabled={locked}
              placeholder={t('integrations.settings.actions.valuePlaceholder')}
              onChange={(e) => setValue(key, e.target.value)}
              className={`${inputClass} flex-1 font-mono`}
            />
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                onChange(Object.fromEntries(entries.filter((_, i) => i !== index)))
              }
              className="rounded-kp-md p-2 text-kp-text-tertiary transition-colors hover:bg-kp-danger/10 hover:text-kp-danger disabled:opacity-50"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          disabled={locked || '' in pairs}
          onClick={() => onChange({ ...pairs, '': '' })}
          className="flex items-center gap-1.5 rounded-kp-md border border-dashed border-kp-border px-3 py-2 text-[0.6875rem] font-semibold text-kp-text-tertiary transition-colors hover:border-kp-accent hover:text-kp-accent disabled:opacity-50"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {t('integrations.settings.actions.addRow')}
        </button>
      </div>
    </FieldShell>
  );
}
