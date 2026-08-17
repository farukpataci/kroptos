import type {
  MarketplaceCapability,
  ProviderSettingsManifest,
  ProviderSettingsOverride,
  SettingsField,
  SettingsSection,
  SettingsTab,
} from '@kroptos/shared';
import { BASE_MANIFEST } from './base.settings';

/**
 * Pure resolver: base manifest + provider override => the manifest the API and
 * the UI both work from. Order matters and is fixed (doc §6):
 *
 *   1. deep copy of BASE_MANIFEST
 *   2. + patchFields          (partial writes over base fields)
 *   3. - omitFields / omitSections
 *   4. + addSections / addTabs
 *   5. - fields whose requiresCapability is not in the provider's capabilities
 *   6. - sections and tabs left empty by the steps above
 *   7. + credentials, wizardPatch, crossRules, docsUrl
 *
 * `BASE_MANIFEST` is never mutated — every caller gets its own tree, so a
 * provider override cannot leak into the next provider resolved.
 */

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyPatchFields(
  tabs: SettingsTab[],
  patchFields: Record<string, Partial<SettingsField>> | undefined,
): void {
  if (!patchFields) return;
  for (const tab of tabs) {
    for (const section of tab.sections) {
      section.fields = section.fields.map((field) => {
        const patch = patchFields[field.key];
        return patch ? { ...field, ...patch } : field;
      });
    }
  }
}

function applyOmissions(
  tabs: SettingsTab[],
  omitFields: string[] | undefined,
  omitSections: string[] | undefined,
): SettingsTab[] {
  const droppedFields = new Set(omitFields ?? []);
  const droppedSections = new Set(omitSections ?? []);

  return tabs.map((tab) => ({
    ...tab,
    sections: tab.sections
      .filter((section) => !droppedSections.has(section.id))
      .map((section) => ({
        ...section,
        fields: section.fields.filter((field) => !droppedFields.has(field.key)),
      })),
  }));
}

function applyAddSections(
  tabs: SettingsTab[],
  addSections: ProviderSettingsOverride['addSections'],
): void {
  if (!addSections) return;
  for (const entry of addSections) {
    const tab = tabs.find((t) => t.id === entry.tabId);
    if (!tab) {
      // A provider aiming at a tab the base does not define is a manifest bug,
      // not a runtime condition — surface it at boot rather than silently
      // dropping the section and letting a required field vanish from the form.
      throw new Error(
        `Provider settings override targets unknown tab '${entry.tabId}' (section '${entry.section.id}')`,
      );
    }
    const section = deepCopy(entry.section);
    if (entry.position === 'start') {
      tab.sections.unshift(section);
    } else {
      tab.sections.push(section);
    }
  }
}

function filterByCapabilities(
  tabs: SettingsTab[],
  capabilities: MarketplaceCapability[],
): SettingsTab[] {
  const granted = new Set(capabilities);
  const allowed = (required?: MarketplaceCapability) => !required || granted.has(required);

  return tabs
    .filter((tab) => allowed(tab.requiresCapability))
    .map((tab) => ({
      ...tab,
      sections: tab.sections
        .filter((section) => allowed(section.requiresCapability))
        .map((section) => ({
          ...section,
          fields: section.fields.filter((field) => allowed(field.requiresCapability)),
        })),
    }));
}

function dropEmpty(tabs: SettingsTab[]): SettingsTab[] {
  return tabs
    .map((tab) => ({
      ...tab,
      sections: tab.sections.filter((section: SettingsSection) => section.fields.length > 0),
    }))
    .filter((tab) => tab.sections.length > 0);
}

function applyWizardPatch(
  manifest: ProviderSettingsManifest,
  wizardPatch: ProviderSettingsOverride['wizardPatch'],
): void {
  if (wizardPatch) {
    manifest.wizard = manifest.wizard.map((step) => {
      const patch = wizardPatch[step.id];
      return patch ? { ...step, ...patch } : step;
    });
  }

  // A step pointing at a tab that capability filtering removed would stall the
  // wizard on an empty screen, so prune those alongside the tabs themselves.
  const tabIds = new Set(manifest.tabs.map((t) => t.id));
  manifest.wizard = manifest.wizard.filter((step) => !step.tabId || tabIds.has(step.tabId));
}

export function resolveManifest(override: ProviderSettingsOverride): ProviderSettingsManifest {
  const base = deepCopy(BASE_MANIFEST);

  let tabs = base.tabs;
  applyPatchFields(tabs, override.patchFields);
  tabs = applyOmissions(tabs, override.omitFields, override.omitSections);
  applyAddSections(tabs, override.addSections);

  if (override.addTabs) {
    tabs = [...tabs, ...deepCopy(override.addTabs)];
  }

  tabs = filterByCapabilities(tabs, override.capabilities);
  tabs = dropEmpty(tabs);

  const manifest: ProviderSettingsManifest = {
    provider: override.provider,
    displayName: override.displayName,
    version: override.version ?? base.version,
    capabilities: [...override.capabilities],
    // Passed through untouched: these deliberately do not take part in
    // `filterByCapabilities`, so a planned capability hides its fields exactly
    // like an absent one while still being reportable.
    ...(override.plannedCapabilities ? { plannedCapabilities: [...override.plannedCapabilities] } : {}),
    credentials: deepCopy(override.credentials),
    tabs,
    wizard: base.wizard,
    crossRules: [...base.crossRules, ...deepCopy(override.addCrossRules ?? [])],
    docsUrl: override.docsUrl,
  };

  applyWizardPatch(manifest, override.wizardPatch);

  return manifest;
}
