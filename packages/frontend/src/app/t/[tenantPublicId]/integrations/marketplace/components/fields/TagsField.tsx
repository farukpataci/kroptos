'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { FieldShell, FieldProps, errorInputClass, inputClass } from './FieldShell';

export function TagsField({ field, value, error, disabled, onChange }: FieldProps<string[]>) {
  const t = useTranslations();
  const [draft, setDraft] = useState('');
  const tags = Array.isArray(value) ? value : [];

  const commit = () => {
    const entry = draft.trim();
    if (!entry || tags.includes(entry)) {
      setDraft('');
      return;
    }
    onChange([...tags, entry]);
    setDraft('');
  };

  return (
    <FieldShell field={field} error={error} htmlFor={field.key}>
      <div className="space-y-2">
        <input
          id={field.key}
          type="text"
          value={draft}
          disabled={disabled || field.readOnly}
          placeholder={
            field.placeholderKey
              ? t(field.placeholderKey)
              : t('integrations.settings.actions.addTag')
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter must not submit the surrounding form — it commits a tag.
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={commit}
          className={`${inputClass} ${error ? errorInputClass : ''}`}
        />

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-kp-md border border-kp-border bg-kp-bg-tertiary px-2 py-1 text-[0.6875rem] font-semibold text-kp-text-secondary"
              >
                {tag}
                <button
                  type="button"
                  disabled={disabled || field.readOnly}
                  onClick={() => onChange(tags.filter((entry) => entry !== tag))}
                  className="text-kp-text-tertiary transition-colors hover:text-kp-danger"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </FieldShell>
  );
}
