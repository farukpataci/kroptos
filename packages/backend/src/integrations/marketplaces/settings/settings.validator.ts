import { Injectable } from '@nestjs/common';
import type {
  ProviderSettingsManifest,
  SettingsCrossRule,
  SettingsField,
  SettingsValidationError,
  SettingsValidationResult,
} from '@kroptos/shared';
import { collectFields, evaluateCondition, isEmptyValue } from '@kroptos/shared';

const I = 'integrations.settings.validation';

/**
 * Generic manifest-driven validation. There is deliberately no provider branch
 * anywhere in this file — a provider adds fields and cross rules to its
 * manifest, not cases here.
 */
@Injectable()
export class SettingsValidator {
  /** Keys the manifest does not define. Rejected rather than stored quietly. */
  unknownKeys(manifest: ProviderSettingsManifest, values: Record<string, unknown>): string[] {
    const known = new Set(collectFields(manifest).map((f) => f.key));
    return Object.keys(values).filter((key) => !known.has(key));
  }

  /**
   * Values with every invisible field stripped. A field hidden by its own or
   * its section's `visibleWhen` must not linger in storage — a stale
   * `stock.warehouseIds` would come back the moment the user flips the source
   * back, silently re-applying a selection they never confirmed.
   */
  pruneInvisible(
    manifest: ProviderSettingsManifest,
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    const visible = new Set<string>();
    for (const tab of manifest.tabs) {
      for (const section of tab.sections) {
        if (!evaluateCondition(section.visibleWhen, values)) continue;
        for (const field of section.fields) {
          if (evaluateCondition(field.visibleWhen, values)) visible.add(field.key);
        }
      }
    }

    const pruned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (visible.has(key)) pruned[key] = value;
    }
    return pruned;
  }

  validate(
    manifest: ProviderSettingsManifest,
    effective: Record<string, unknown>,
    options: { scopeKeys?: string[] } = {},
  ): SettingsValidationResult {
    const errors: SettingsValidationError[] = [];
    const scope = options.scopeKeys ? new Set(options.scopeKeys) : null;

    for (const tab of manifest.tabs) {
      for (const section of tab.sections) {
        if (!evaluateCondition(section.visibleWhen, effective)) continue;

        for (const field of section.fields) {
          if (scope && !scope.has(field.key)) continue;
          if (!evaluateCondition(field.visibleWhen, effective)) continue;
          this.validateField(field, effective[field.key], errors);
        }
      }
    }

    for (const rule of manifest.crossRules) {
      if (scope && !this.ruleTouchesScope(rule, scope)) continue;
      this.validateCrossRule(rule, effective, errors);
    }

    return { valid: errors.length === 0, errors };
  }

  // ------------------------------------------------------------------ helpers

  private push(
    errors: SettingsValidationError[],
    key: string,
    messageKey: string,
    params?: Record<string, unknown>,
  ): void {
    errors.push({ key, messageKey, params });
  }

  private validateField(
    field: SettingsField,
    value: unknown,
    errors: SettingsValidationError[],
  ): void {
    if (isEmptyValue(value)) {
      if (field.required) this.push(errors, field.key, `${I}.required`);
      return;
    }

    switch (field.type) {
      case 'number':
      case 'percent':
      case 'money':
        this.validateNumeric(field, value, errors);
        return;

      case 'toggle':
        if (typeof value !== 'boolean') {
          this.push(errors, field.key, `${I}.mustBeBoolean`);
        }
        return;

      case 'select':
      case 'radioGroup':
        this.validateChoice(field, value, errors);
        return;

      case 'multiselect':
      case 'weekdays':
        this.validateMultiChoice(field, value, errors);
        return;

      case 'tags':
        if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
          this.push(errors, field.key, `${I}.mustBeStringList`);
        }
        return;

      case 'keyValue':
      case 'mappingTable':
        this.validateRecord(field, value, errors);
        return;

      case 'time':
        if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
          this.push(errors, field.key, `${I}.mustBeTime`);
        }
        return;

      case 'duration':
        this.validateNumeric(field, value, errors);
        return;

      case 'info':
        return;

      default:
        this.validateText(field, value, errors);
    }
  }

  private validateNumeric(
    field: SettingsField,
    value: unknown,
    errors: SettingsValidationError[],
  ): void {
    const num = typeof value === 'number' ? value : Number(value);
    if (typeof value === 'boolean' || !Number.isFinite(num)) {
      this.push(errors, field.key, `${I}.mustBeNumber`);
      return;
    }
    if (field.min !== undefined && num < field.min) {
      this.push(errors, field.key, `${I}.min`, { min: field.min });
    }
    if (field.max !== undefined && num > field.max) {
      this.push(errors, field.key, `${I}.max`, { max: field.max });
    }
    if (field.step !== undefined && field.step > 0) {
      const base = field.min ?? 0;
      const offset = (num - base) / field.step;
      if (Math.abs(offset - Math.round(offset)) > 1e-9) {
        this.push(errors, field.key, `${I}.step`, { step: field.step });
      }
    }
  }

  private validateText(
    field: SettingsField,
    value: unknown,
    errors: SettingsValidationError[],
  ): void {
    if (typeof value !== 'string') {
      this.push(errors, field.key, `${I}.mustBeText`);
      return;
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) {
      this.push(errors, field.key, `${I}.maxLength`, { maxLength: field.maxLength });
    }
    if (field.pattern && !new RegExp(field.pattern).test(value)) {
      this.push(errors, field.key, `${I}.pattern`);
    }
  }

  private validateChoice(
    field: SettingsField,
    value: unknown,
    errors: SettingsValidationError[],
  ): void {
    // resourceSelect and optionsSource-driven fields resolve their options at
    // request time; membership is checked against the tenant's own records in
    // `validateResourceRefs`, not here.
    if (!field.options) return;
    if (!field.options.some((option) => option.value === value)) {
      this.push(errors, field.key, `${I}.invalidOption`);
    }
  }

  private validateMultiChoice(
    field: SettingsField,
    value: unknown,
    errors: SettingsValidationError[],
  ): void {
    if (!Array.isArray(value)) {
      this.push(errors, field.key, `${I}.mustBeList`);
      return;
    }
    if (!field.options) return;
    const allowed = new Set(field.options.map((option) => option.value));
    if (value.some((entry) => !allowed.has(entry as string))) {
      this.push(errors, field.key, `${I}.invalidOption`);
    }
  }

  private validateRecord(
    field: SettingsField,
    value: unknown,
    errors: SettingsValidationError[],
  ): void {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.push(errors, field.key, `${I}.mustBeMap`);
      return;
    }

    const mapping = field.mapping;
    if (!mapping || mapping.allowUnmapped !== false) return;
    if (!Array.isArray(mapping.leftSource)) return; // remote source, cannot check offline

    const mapped = value as Record<string, unknown>;
    const unmapped = mapping.leftSource.filter((option) => isEmptyValue(mapped[option.value]));
    if (unmapped.length > 0) {
      this.push(errors, field.key, `${I}.unmappedValues`, {
        count: unmapped.length,
        values: unmapped.map((option) => option.value).join(', '),
      });
    }
  }

  private ruleTouchesScope(rule: SettingsCrossRule, scope: Set<string>): boolean {
    const keys = [
      rule.requires,
      rule.requiresNonEmptyArray,
      rule.positive,
      rule.matches?.key,
      ...(rule.lte ?? []),
      ...rule.when.map((c) => c.field),
    ].filter(Boolean) as string[];
    return keys.some((key) => scope.has(key));
  }

  private validateCrossRule(
    rule: SettingsCrossRule,
    values: Record<string, unknown>,
    errors: SettingsValidationError[],
  ): void {
    if (!evaluateCondition(rule.when, values)) return;

    const report = (fallbackKey: string) =>
      this.push(errors, rule.errorKey ?? fallbackKey, rule.messageKey);

    if (rule.requires && isEmptyValue(values[rule.requires])) {
      report(rule.requires);
      return; // a missing value cannot also fail its format check
    }

    if (rule.requiresNonEmptyArray) {
      const value = values[rule.requiresNonEmptyArray];
      if (!Array.isArray(value) || value.length === 0) {
        report(rule.requiresNonEmptyArray);
        return;
      }
    }

    if (rule.positive) {
      const value = Number(values[rule.positive]);
      if (!Number.isFinite(value) || value <= 0) {
        report(rule.positive);
        return;
      }
    }

    if (rule.matches) {
      const value = values[rule.matches.key];
      if (typeof value === 'string' && !new RegExp(rule.matches.pattern).test(value)) {
        report(rule.matches.key);
        return;
      }
    }

    if (rule.lte) {
      const [leftKey, rightKey] = rule.lte;
      const left = values[leftKey];
      const right = values[rightKey];
      // Both bounds are optional; the ordering only binds when both are set.
      if (!isEmptyValue(left) && !isEmptyValue(right) && Number(left) > Number(right)) {
        report(leftKey);
      }
    }
  }
}
