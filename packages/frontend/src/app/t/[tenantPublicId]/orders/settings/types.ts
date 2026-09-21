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
  scopes: ScopeLevel[];
  permission?: string;
  sensitive?: boolean;
  canEditSensitive?: boolean;
  dependsOn?: {
    key: string;
    value?: any;
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

export interface SettingSection {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface SettingImpact {
  summary: Array<{
    key: string;
    label: string;
    description: string;
    count?: number;
  }>;
  affectedOrdersCount: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SettingChangeLogItem {
  id: string;
  key: string;
  scopeLevel: string;
  oldValue: any;
  newValue: any;
  changedById?: string;
  changedBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
  reason?: string;
  changeSetId: string;
  createdAt: string;
}
