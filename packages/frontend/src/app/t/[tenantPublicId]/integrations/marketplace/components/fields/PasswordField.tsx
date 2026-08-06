'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { FieldShell, FieldProps, errorInputClass, inputClass } from './FieldShell';

/**
 * The API returns a stored secret as `••••1234`. Leaving that value untouched
 * and submitting it is the normal case, and the server treats the mask as
 * "no change" — so the input starts read-only until the user clicks to replace
 * it, rather than inviting an accidental edit of a value nobody can see.
 */
export function PasswordField({ field, value, error, disabled, onChange }: FieldProps<string>) {
  const t = useTranslations();
  const [revealed, setRevealed] = useState(false);

  const text = typeof value === 'string' ? value : '';
  const isStoredMask = text.startsWith('••••');

  return (
    <FieldShell field={field} error={error} htmlFor={field.key}>
      <div className="relative">
        <input
          id={field.key}
          type={revealed && !isStoredMask ? 'text' : 'password'}
          value={text}
          readOnly={field.readOnly}
          disabled={disabled}
          autoComplete="off"
          placeholder={field.placeholderKey ? t(field.placeholderKey) : '••••••••••••'}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (isStoredMask) onChange('');
          }}
          className={`${inputClass} pr-10 font-mono ${error ? errorInputClass : ''}`}
        />
        {!isStoredMask && text.length > 0 && (
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-text-tertiary transition-colors hover:text-kp-text-primary"
            aria-label={t(revealed ? 'integrations.settings.actions.hide' : 'integrations.settings.actions.reveal')}
          >
            {revealed ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        )}
      </div>
      {isStoredMask && (
        <p className="mt-1.5 text-[0.6875rem] text-kp-text-tertiary">
          {t('integrations.settings.secretStored')}
        </p>
      )}
    </FieldShell>
  );
}
