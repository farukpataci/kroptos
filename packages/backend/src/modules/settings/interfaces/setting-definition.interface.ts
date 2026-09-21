export type SettingType =
  | 'boolean'
  | 'int'
  | 'decimal'
  | 'money'
  | 'enum'
  | 'string'
  | 'duration'
  | 'time'
  | 'json'
  | 'tags'
  | 'reference';

export type ScopeLevel = 'AGENCY' | 'CLIENT' | 'STORE';
export type EffectiveSourceLevel = 'SYSTEM' | 'AGENCY' | 'CLIENT' | 'STORE';

export interface SettingValidationDef {
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string | number; label: string; description?: string }>;
  regex?: string;
  referenceType?: 'orderStatus' | 'carrier' | 'warehouse' | 'category' | 'paymentMethod';
  allowCustom?: boolean;
}

export interface SettingDefinition {
  key: string;
  type: SettingType;
  default: any;
  validation?: SettingValidationDef;
  section: string;
  labelKey: string;
  descriptionKey: string;
  scopes: ScopeLevel[]; // which hierarchy levels can override this setting
  permission?: string; // specific permission needed if any
  sensitive?: boolean; // sensitive settings require update_sensitive permission
  dependsOn?: {
    key: string;
    value?: any; // if omitted, truthy is checked
  };
  unit?: string;
  sinceVersion?: string;
}

export interface EffectiveSettingValue {
  key: string;
  value: any;
  sourceLevel: EffectiveSourceLevel;
  inheritedValue: any;
  isOverridden: boolean;
  isLocked: boolean;
  lockedAtLevel?: ScopeLevel;
  canEdit: boolean;
  definition: SettingDefinition;
}

export interface SettingChangeItem {
  key: string;
  value: any;
}
