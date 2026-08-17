/**
 * Integration settings manifest — the single source of truth for what a
 * marketplace integration can be configured with.
 *
 * Backend validation, the frontend form, the setup wizard, i18n keys and
 * default values are all derived from a `ProviderSettingsManifest`. Nothing
 * downstream of this file is allowed to branch on the provider name: a new
 * marketplace is a new `ProviderSettingsOverride`, not an edit to the renderer
 * or the validator.
 */

// ---------- Field types ----------

export type SettingsFieldType =
  | 'text' | 'textarea' | 'password' | 'number' | 'percent' | 'money'
  | 'toggle' | 'select' | 'multiselect' | 'radioGroup'
  | 'time' | 'duration' | 'weekdays'
  | 'tags' | 'keyValue'
  | 'resourceSelect'   // pick from a remote collection (warehouse, price list, ERP integration, carrier)
  | 'mappingTable'     // left: marketplace value, right: KroptOS value
  | 'info';            // read-only note / warning box

export type ConditionOp =
  | 'eq' | 'neq'
  | 'in' | 'notIn'           // the field's own value is one of `value`
  | 'contains' | 'notContains' // the field holds an array that includes `value`
  | 'truthy' | 'falsy'
  | 'gt' | 'lt';

export interface SettingsCondition {
  field: string;                 // 'stock.source'
  op: ConditionOp;
  value?: unknown;
}

export interface SettingsFieldOption {
  value: string;
  labelKey: string;              // i18n key
  descriptionKey?: string;
  disabled?: boolean;
}

/** Dynamic option source — the frontend pulls it with apiFetch and caches the result. */
export interface SettingsOptionSource {
  endpoint: string;              // '/warehouses' | '/integrations?providerType=erp'
  valueField: string;            // 'id'
  labelField: string;            // 'name'
  params?: Record<string, string>;
  dependsOn?: string;            // refetch when another field's value changes
}

export type MarketplaceCapability =
  | 'orders.read' | 'orders.updateStatus' | 'orders.cancel'
  | 'products.push' | 'products.read'
  | 'stock.push' | 'price.push'
  | 'categories.read' | 'attributes.read'
  | 'shipment.label' | 'shipment.track'
  | 'returns.read' | 'invoice.upload'
  | 'commission.read' | 'buybox.read';

export interface SettingsFieldMapping {
  leftLabelKey: string;
  rightLabelKey: string;
  leftSource: SettingsOptionSource | SettingsFieldOption[];   // marketplace side
  rightSource: SettingsOptionSource | SettingsFieldOption[];  // KroptOS side
  allowUnmapped?: boolean;
}

export interface SettingsField {
  key: string;                   // 'stock.bufferQuantity'  (section.field)
  type: SettingsFieldType;
  labelKey: string;
  helpKey?: string;              // hint rendered under the field
  placeholderKey?: string;
  default?: unknown;
  required?: boolean;            // fields the wizard treats as mandatory
  readOnly?: boolean;
  secret?: boolean;              // stored in secretsEncrypted, returned masked

  options?: SettingsFieldOption[];
  optionsSource?: SettingsOptionSource;

  min?: number;
  max?: number;
  step?: number;
  unitKey?: string;              // 'adet' | 'dakika' | '%' | '₺'
  pattern?: string;              // regex source
  maxLength?: number;

  visibleWhen?: SettingsCondition | SettingsCondition[];   // array = AND
  disabledWhen?: SettingsCondition | SettingsCondition[];

  /** mappingTable only */
  mapping?: SettingsFieldMapping;

  colSpan?: 1 | 2;               // within the 2-column grid
  badgeKey?: string;             // 'beta' | 'providerOnly' | 'advanced'
  /** Connector capability required for this field to apply */
  requiresCapability?: MarketplaceCapability;

  /**
   * A field the connector does not read (yet). It stays in the manifest and the
   * renderer skips it — removing it outright would make the settings layer prune
   * whatever the seller already saved under that key, and reject a save that
   * echoes it back as an unknown key.
   */
  deprecated?: boolean;
}

export interface SettingsSection {
  id: string;                    // 'stock.policy'
  titleKey: string;
  descriptionKey?: string;
  icon?: string;                 // heroicon name, e.g. 'CubeIcon'
  fields: SettingsField[];
  visibleWhen?: SettingsCondition | SettingsCondition[];
  collapsedByDefault?: boolean;
  requiresCapability?: MarketplaceCapability;
}

export interface SettingsTab {
  id: string;                    // 'orders'
  titleKey: string;
  icon?: string;
  sections: SettingsSection[];
  requiresCapability?: MarketplaceCapability;
}

export interface SettingsWizardStep {
  id: string;                    // 'stock'
  titleKey: string;
  descriptionKey?: string;
  tabId?: string;                // whole tab
  sectionIds?: string[];         // or specific sections
  required: boolean;             // false = "skip for now" is offered
}

/** A cross-field rule that a single field definition cannot express. */
export interface SettingsCrossRule {
  id: string;
  /** Rule applies only when every condition holds. */
  when: SettingsCondition[];
  /** Then this field must hold a non-empty value... */
  requires?: string;
  /** ...and/or these two numeric fields must stay ordered (`lte`: left <= right). */
  lte?: [string, string];
  /** ...and/or this field must be a non-empty array. */
  requiresNonEmptyArray?: string;
  /** ...and/or this field must match the regex. */
  matches?: { key: string; pattern: string };
  /** ...and/or this numeric field must be greater than zero. */
  positive?: string;
  messageKey: string;
  /** Key the error is reported against; defaults to the constrained field. */
  errorKey?: string;
}

export interface ProviderSettingsManifest {
  provider: string;              // 'trendyol'
  displayName: string;
  version: number;               // schemaVersion
  capabilities: MarketplaceCapability[];
  /**
   * The subset of `capabilities` the connector does not actually implement yet.
   *
   * An annotation, not a substitute: base tabs are gated by `requiresCapability`,
   * so dropping a capability deletes the whole tab — and with it the stored
   * values of every field inside, since `save` prunes keys the manifest no
   * longer knows. The schema therefore keeps the capability and the UI reads
   * this list to present it as planned rather than working.
   */
  plannedCapabilities?: MarketplaceCapability[];
  credentials: SettingsField[];  // API credentials form (wizard step 1)
  tabs: SettingsTab[];
  wizard: SettingsWizardStep[];
  crossRules: SettingsCrossRule[];
  docsUrl?: string;              // "how do I get these?" link
}

/** The diff a provider file writes on top of the base manifest. */
export interface ProviderSettingsOverride {
  provider: string;
  displayName: string;
  version?: number;
  capabilities: MarketplaceCapability[];
  /** subset of `capabilities` that is not implemented; see ProviderSettingsManifest */
  plannedCapabilities?: MarketplaceCapability[];
  credentials: SettingsField[];
  /** field / section keys to drop from base */
  omitFields?: string[];
  omitSections?: string[];
  /** partial writes over base fields: { 'stock.source': { default: 'warehouse' } } */
  patchFields?: Record<string, Partial<SettingsField>>;
  /** extra sections appended to a base tab */
  addSections?: Array<{ tabId: string; section: SettingsSection; position?: 'start' | 'end' }>;
  /** entirely new tab (e.g. Trendyol-only) */
  addTabs?: SettingsTab[];
  wizardPatch?: Record<string, Partial<SettingsWizardStep>>;
  addCrossRules?: SettingsCrossRule[];
  docsUrl?: string;
}

// ---------- API payloads ----------

export interface SettingsValidationError {
  key: string;
  messageKey: string;
  params?: Record<string, unknown>;
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: SettingsValidationError[];
}

export interface EffectiveSettings {
  integrationId: string;
  provider: string;
  schemaVersion: number;
  /** only the values the user explicitly set */
  values: Record<string, unknown>;
  /** manifest defaults */
  defaults: Record<string, unknown>;
  /** { ...defaults, ...values } — what the connector actually sees */
  effective: Record<string, unknown>;
  isConfigured: boolean;
  completedSteps: string[];
  missingRequired: string[];
  lastAppliedAt?: string | null;
  updatedAt?: string | null;
}

export interface SettingsRevisionSummary {
  id: string;
  version: number;
  diff?: Record<string, { before: unknown; after: unknown }> | null;
  changedByUserId?: string | null;
  changedByName?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface ProviderSummary {
  provider: string;
  displayName: string;
  capabilities: MarketplaceCapability[];
  /** Subset of the above with no working implementation; see ProviderSettingsManifest. */
  plannedCapabilities?: MarketplaceCapability[];
  docsUrl?: string;
}
