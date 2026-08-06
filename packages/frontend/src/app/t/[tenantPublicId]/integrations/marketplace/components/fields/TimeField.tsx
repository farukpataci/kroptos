'use client';

import { FieldShell, FieldProps, errorInputClass, inputClass } from './FieldShell';

export function TimeField({ field, value, error, disabled, onChange }: FieldProps<string>) {
  return (
    <FieldShell field={field} error={error} htmlFor={field.key}>
      <input
        id={field.key}
        type="time"
        value={typeof value === 'string' ? value : ''}
        readOnly={field.readOnly}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${error ? errorInputClass : ''}`}
      />
    </FieldShell>
  );
}
