import type {
  ProviderSettingsManifest,
  SettingsCondition,
  SettingsField,
  SettingsSection,
} from './types';

/**
 * Visibility rules run in two places — the backend validator decides whether a
 * field is required, the frontend decides whether to draw it. They must agree,
 * or the form shows a field the server ignores (or worse, hides one the server
 * still demands). Hence a single pure implementation imported by both.
 */

/** Empty for validation purposes: null, undefined, '', [] and {} all count. */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function evaluateCondition(
  condition: SettingsCondition | SettingsCondition[] | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!condition) return true;
  if (Array.isArray(condition)) {
    return condition.every((c) => evaluateCondition(c, values));
  }

  const actual = values[condition.field];

  switch (condition.op) {
    case 'eq':
      return actual === condition.value;
    case 'neq':
      return actual !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(actual as never);
    case 'notIn':
      return !Array.isArray(condition.value) || !condition.value.includes(actual as never);
    case 'contains':
      return Array.isArray(actual) && actual.includes(condition.value as never);
    case 'notContains':
      return !Array.isArray(actual) || !actual.includes(condition.value as never);
    case 'truthy':
      return !isEmptyValue(actual) && actual !== false;
    case 'falsy':
      return isEmptyValue(actual) || actual === false;
    case 'gt': {
      const a = toNumber(actual);
      const b = toNumber(condition.value);
      return a !== null && b !== null && a > b;
    }
    case 'lt': {
      const a = toNumber(actual);
      const b = toNumber(condition.value);
      return a !== null && b !== null && a < b;
    }
    default:
      return true;
  }
}

/** Every field in the manifest, flattened across tabs and sections. */
export function collectFields(manifest: ProviderSettingsManifest): SettingsField[] {
  const fields: SettingsField[] = [];
  for (const tab of manifest.tabs) {
    for (const section of tab.sections) {
      fields.push(...section.fields);
    }
  }
  return fields;
}

/** The section a given field key belongs to, or undefined for an unknown key. */
export function findSectionForField(
  manifest: ProviderSettingsManifest,
  key: string,
): SettingsSection | undefined {
  for (const tab of manifest.tabs) {
    for (const section of tab.sections) {
      if (section.fields.some((f) => f.key === key)) return section;
    }
  }
  return undefined;
}

/** The tab a given field key belongs to, used to jump to the first failing tab. */
export function findTabIdForField(
  manifest: ProviderSettingsManifest,
  key: string,
): string | undefined {
  for (const tab of manifest.tabs) {
    for (const section of tab.sections) {
      if (section.fields.some((f) => f.key === key)) return tab.id;
    }
  }
  return undefined;
}

/**
 * Manifest defaults as a flat map. These are deliberately never persisted —
 * merging them at read time means bumping a default in the manifest also moves
 * every integration that never overrode it.
 */
export function collectDefaults(manifest: ProviderSettingsManifest): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of collectFields(manifest)) {
    if (field.default !== undefined) {
      defaults[field.key] = field.default;
    }
  }
  return defaults;
}

/** What the connector sees: user values layered over manifest defaults. */
export function mergeEffective(
  manifest: ProviderSettingsManifest,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return { ...collectDefaults(manifest), ...values };
}

/** Fields whose section and own `visibleWhen` both hold for the given values. */
export function visibleFields(
  manifest: ProviderSettingsManifest,
  values: Record<string, unknown>,
): SettingsField[] {
  const visible: SettingsField[] = [];
  for (const tab of manifest.tabs) {
    for (const section of tab.sections) {
      if (!evaluateCondition(section.visibleWhen, values)) continue;
      for (const field of section.fields) {
        if (evaluateCondition(field.visibleWhen, values)) visible.push(field);
      }
    }
  }
  return visible;
}

/**
 * Required-but-empty keys among the currently visible fields. Drives both the
 * "N required fields missing" badge and the sync guard.
 */
export function missingRequiredKeys(
  manifest: ProviderSettingsManifest,
  effective: Record<string, unknown>,
): string[] {
  return visibleFields(manifest, effective)
    .filter((field) => field.required && isEmptyValue(effective[field.key]))
    .map((field) => field.key);
}

/** Secret field keys, used to split values and to redact logs. */
export function secretKeys(manifest: ProviderSettingsManifest): string[] {
  return collectFields(manifest)
    .filter((f) => f.secret)
    .map((f) => f.key);
}

/**
 * Copy of `values` with every secret replaced by a placeholder. Applied before
 * anything reaches an audit row, an ApiLog body or a console line.
 */
export function redactSecrets(
  manifest: ProviderSettingsManifest,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const secrets = new Set(secretKeys(manifest));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = secrets.has(key) ? '[REDACTED]' : value;
  }
  return out;
}
