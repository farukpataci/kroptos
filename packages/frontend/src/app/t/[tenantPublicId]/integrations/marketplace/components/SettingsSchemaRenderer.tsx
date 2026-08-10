'use client';

import type { ProviderSettingsManifest, SettingsField, SettingsSection } from '@kroptos/shared';
import { isDisabled, isVisible } from '@kroptos/shared';
import { FIELD_REGISTRY } from './fields';
import { SettingsSectionCard } from './SettingsSectionCard';

interface Props {
  manifest: ProviderSettingsManifest;
  /** Render one tab, or pass explicit sections (the wizard renders a step). */
  activeTabId?: string;
  sections?: SettingsSection[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (key: string, value: unknown) => void;
  onResetSection?: (sectionId: string) => void;
}

function resolveSections(
  manifest: ProviderSettingsManifest,
  activeTabId?: string,
  explicit?: SettingsSection[],
): SettingsSection[] {
  if (explicit) return explicit;
  return manifest.tabs.find((tab) => tab.id === activeTabId)?.sections ?? [];
}

function FieldRenderer({
  field,
  values,
  errors,
  disabled,
  onChange,
}: {
  field: SettingsField;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (key: string, value: unknown) => void;
}) {
  const Component = FIELD_REGISTRY[field.type];

  if (!Component) {
    // A manifest from a newer backend can name a type this build has no
    // component for. Skipping it keeps the rest of the form usable instead of
    // taking the whole drawer down.
    console.warn(`[settings] No field component registered for type '${field.type}' (${field.key})`);
    return null;
  }

  return (
    <Component
      field={field}
      value={values[field.key]}
      error={errors[field.key]}
      disabled={disabled || isDisabled(field.disabledWhen, values)}
      onChange={(next: unknown) => onChange(field.key, next)}
    />
  );
}

/**
 * Turns a manifest into a form. Visibility is decided with the same
 * `evaluateCondition` the backend validator uses, so a field the user cannot
 * see is exactly the field the server will not require.
 */
export function SettingsSchemaRenderer({
  manifest,
  activeTabId,
  sections,
  values,
  errors,
  disabled,
  onChange,
  onResetSection,
}: Props) {
  const visibleSections = resolveSections(manifest, activeTabId, sections).filter((section) =>
    isVisible(section.visibleWhen, values),
  );

  return (
    <div className="space-y-5">
      {visibleSections.map((section) => {
        const fields = section.fields.filter((field) => isVisible(field.visibleWhen, values));
        if (fields.length === 0) return null;

        const hasError = fields.some((field) => errors[field.key]);

        return (
          <SettingsSectionCard
            key={section.id}
            section={section}
            hasError={hasError}
            onReset={onResetSection ? () => onResetSection(section.id) : undefined}
          >
            {fields.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                values={values}
                errors={errors}
                disabled={disabled}
                onChange={onChange}
              />
            ))}
          </SettingsSectionCard>
        );
      })}
    </div>
  );
}
