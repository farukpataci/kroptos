'use client';

import { useTranslations } from 'next-intl';
import { FieldShell, FieldProps, UnitSuffix, errorInputClass, inputClass } from './FieldShell';

function NumericInput({
  field,
  value,
  error,
  disabled,
  onChange,
  unitKey,
  step,
}: FieldProps<number | ''> & { unitKey?: string; step?: number }) {
  const t = useTranslations();

  return (
    <FieldShell field={field} error={error} htmlFor={field.key}>
      <div className="relative">
        <input
          id={field.key}
          type="number"
          value={value === undefined || value === null ? '' : (value as number | '')}
          min={field.min}
          max={field.max}
          step={step ?? field.step}
          readOnly={field.readOnly}
          disabled={disabled}
          placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
          // An empty box means "unset", not zero — a cap or floor price the
          // user cleared must not come back as a hard 0.
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={`${inputClass} ${unitKey ? 'pr-14' : ''} ${error ? errorInputClass : ''}`}
        />
        <UnitSuffix unitKey={unitKey} />
      </div>
    </FieldShell>
  );
}

export function NumberField(props: FieldProps<number | ''>) {
  return <NumericInput {...props} unitKey={props.field.unitKey} />;
}

export function PercentField(props: FieldProps<number | ''>) {
  return (
    <NumericInput
      {...props}
      unitKey={props.field.unitKey ?? 'integrations.settings.units.percent'}
      step={props.field.step ?? 0.1}
    />
  );
}

export function MoneyField(props: FieldProps<number | ''>) {
  return (
    <NumericInput
      {...props}
      unitKey={props.field.unitKey ?? 'integrations.settings.units.currency'}
      step={props.field.step ?? 0.01}
    />
  );
}

export function DurationField(props: FieldProps<number | ''>) {
  return (
    <NumericInput
      {...props}
      unitKey={props.field.unitKey ?? 'integrations.settings.units.minutes'}
    />
  );
}
