'use client';

import type {
  MarketplaceCapability,
  ProviderSettingsManifest,
  SettingsField,
  SettingsSection,
} from '@kroptos/shared';
import { isDisabled, isVisible } from '@kroptos/shared';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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

/**
 * Whether a tab, section or field hangs off a capability the provider declares
 * but has not implemented.
 *
 * The capability stays granted on purpose — base tabs are gated by
 * `requiresCapability`, so revoking it would delete the tab and make the backend
 * prune every value already saved inside it. The form therefore still renders
 * and still saves; it only stops implying the values reach the marketplace.
 */
function isPlanned(
  manifest: ProviderSettingsManifest,
  activeTabId: string | undefined,
  section?: SettingsSection,
  field?: SettingsField,
): boolean {
  const planned = manifest.plannedCapabilities;
  if (!planned || planned.length === 0) return false;

  const tab = manifest.tabs.find((candidate) => candidate.id === activeTabId);
  const required: Array<MarketplaceCapability | undefined> = [
    tab?.requiresCapability,
    section?.requiresCapability,
    field?.requiresCapability,
  ];

  return required.some((capability) => capability !== undefined && planned.includes(capability));
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

  // The whole tab hangs off a capability that has no connector code behind it.
  const tabIsPlanned = isPlanned(manifest, activeTabId);

  return (
    <div className="space-y-5">
      {tabIsPlanned && (
        <div
          role="status"
          data-testid="planned-capability-notice"
          className="flex gap-2 rounded-kp-md border border-kp-warning/20 bg-kp-warning/10 p-3 text-xs text-kp-warning"
        >
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          <span>
            Bu sekmedeki ayarlar {manifest.displayName} için <strong>henüz desteklenmiyor</strong>.
            Kayıtlı değerleriniz korunur, ancak bağlayıcı bu bölümü okumadığı için senkronizasyona
            etkisi olmaz.
          </span>
        </div>
      )}
      {visibleSections.map((section) => {
        // `deprecated` fields stay in the manifest on purpose — removing a key
        // makes the settings service prune whatever the seller already saved
        // under it, and reject any save that sends it back — but the connector
        // does not read them, so offering them here would be a promise the sync
        // cannot keep. Hidden here, still known to the backend.
        const fields = section.fields.filter(
          (field) => !field.deprecated && isVisible(field.visibleWhen, values),
        );
        // A section whose every field is deprecated has nothing left to show.
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
                // Read-only rather than removed: the save path and the stored
                // values stay exactly as they were, the user just cannot keep
                // filling in something the connector will never read.
                disabled={disabled || isPlanned(manifest, activeTabId, section, field)}
                onChange={onChange}
              />
            ))}
          </SettingsSectionCard>
        );
      })}
    </div>
  );
}
