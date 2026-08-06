'use client';

import type { FC } from 'react';
import type { SettingsFieldType } from '@kroptos/shared';
import type { FieldProps } from './FieldShell';
import { TextField, TextareaField } from './TextField';
import { PasswordField } from './PasswordField';
import { DurationField, MoneyField, NumberField, PercentField } from './NumberField';
import { ToggleField } from './ToggleField';
import { SelectField } from './SelectField';
import { MultiSelectField } from './MultiSelectField';
import { RadioGroupField } from './RadioGroupField';
import { TimeField } from './TimeField';
import { WeekdaysField } from './WeekdaysField';
import { TagsField } from './TagsField';
import { KeyValueField } from './KeyValueField';
import { ResourceSelectField } from './ResourceSelectField';
import { MappingTableField } from './MappingTableField';
import { InfoField } from './InfoField';

/**
 * The whole point of the settings engine: a manifest field type maps to exactly
 * one component here. Supporting a new type is one component plus one line —
 * the renderer, the drawer and the wizard stay untouched.
 */
export const FIELD_REGISTRY: Record<SettingsFieldType, FC<FieldProps<any>>> = {
  text: TextField,
  textarea: TextareaField,
  password: PasswordField,
  number: NumberField,
  percent: PercentField,
  money: MoneyField,
  toggle: ToggleField,
  select: SelectField,
  multiselect: MultiSelectField,
  radioGroup: RadioGroupField,
  time: TimeField,
  duration: DurationField,
  weekdays: WeekdaysField,
  tags: TagsField,
  keyValue: KeyValueField,
  resourceSelect: ResourceSelectField,
  mappingTable: MappingTableField,
  info: InfoField,
};

export type { FieldProps };
export { SettingsFieldContext } from './useOptionSource';
