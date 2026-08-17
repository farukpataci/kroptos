import * as fs from 'fs';
import * as path from 'path';
import type {
  ProviderSettingsManifest,
  ProviderSettingsOverride,
  SettingsField,
} from '@kroptos/shared';
import { MarketplaceSettingsRegistry } from './manifest.registry';
import { zalandoOverride } from './providers/zalando.settings';
import { aliexpressOverride } from './providers/aliexpress.settings';

/**
 * A manifest references message keys; the dictionary supplies them. Nothing
 * connected the two, so a provider could ship with no translations at all and
 * typecheck, tests and build would every one of them pass — the failure only
 * showed up as `INTEGRATIONS.SETTINGS.FIELDS…` printed on the screen.
 *
 * This walks the registry rather than a hand-written list, so a provider added
 * without its translations fails here instead of in front of a user. It found
 * pazarama and etsy already broken when it was written.
 *
 * It lives in the backend because that is the only package that can see both
 * sides: the manifests are here, the dictionaries are in the frontend.
 */

const MESSAGES_DIR = path.resolve(process.cwd(), '..', 'frontend', 'messages');

/**
 * Mirrors I18nProvider: every locale is layered over `tr` and then `en-US`, so
 * a key present only in `tr` still resolves everywhere. Asserting against the
 * merged dictionary is what the user actually sees; asserting per raw file
 * would demand translations the app never needed.
 */
function deepMerge(base: any, override: any): any {
  if (!override) return base;
  const merged: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key];
    const bothPlainObjects =
      value && typeof value === 'object' && !Array.isArray(value) &&
      existing && typeof existing === 'object' && !Array.isArray(existing);
    merged[key] = bothPlainObjects ? deepMerge(existing, value) : value;
  }
  return merged;
}

function loadLocale(file: string): any {
  return JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, file), 'utf8'));
}

function resolves(dictionary: any, dottedKey: string): boolean {
  let node = dictionary;
  for (const part of dottedKey.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return false;
    node = node[part];
  }
  return typeof node === 'string' && node.length > 0;
}

function fieldKeys(field: SettingsField): string[] {
  const keys: string[] = [];
  if (field.labelKey) keys.push(field.labelKey);
  if (field.helpKey) keys.push(field.helpKey);
  if ((field as any).placeholderKey) keys.push((field as any).placeholderKey);
  if ((field as any).unitKey) keys.push((field as any).unitKey);
  for (const option of field.options ?? []) {
    if (option.labelKey) keys.push(option.labelKey);
  }
  return keys;
}

function manifestKeys(manifest: ProviderSettingsManifest): string[] {
  const keys: string[] = [];
  for (const field of manifest.credentials ?? []) keys.push(...fieldKeys(field));
  for (const tab of manifest.tabs ?? []) {
    if (tab.titleKey) keys.push(tab.titleKey);
    if ((tab as any).descriptionKey) keys.push((tab as any).descriptionKey);
    for (const section of tab.sections ?? []) {
      if (section.titleKey) keys.push(section.titleKey);
      if (section.descriptionKey) keys.push(section.descriptionKey);
      for (const field of section.fields ?? []) keys.push(...fieldKeys(field));
    }
  }
  for (const step of manifest.wizard ?? []) {
    if (step.titleKey) keys.push(step.titleKey);
    if (step.descriptionKey) keys.push(step.descriptionKey);
  }
  return [...new Set(keys)];
}

/**
 * Providers whose manifest exists but is deliberately not in the registry yet,
 * paired with why. Keeping them here means their translations are covered
 * before they are switched on.
 */
const UNREGISTERED: Array<[string, ProviderSettingsOverride]> = [
  // temu moved out on 2026-08-14: it is registered now, so the loop over
  // `registry.listProviders()` above covers it — and covers more of it than this
  // list did, since that path checks tab, section and wizard keys too.
  //
  // emag was never in this list: it went straight into `OVERRIDES` on
  // 2026-08-14, so the registry loop covers it. Its dictionary entries are NOT
  // written yet — the case above fails for `emag` until the UI step adds them,
  // and that failure is the intended reminder rather than something to silence
  // by parking the provider here.
  ['zalando', zalandoOverride],
  ['aliexpress', aliexpressOverride],
];

describe('provider manifests have translations', () => {
  const registry = new MarketplaceSettingsRegistry();
  const providers = registry.listProviders().map((p) => p.provider);

  const localeFiles = fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json'));
  const tr = loadLocale('tr.json');
  const enUS = loadLocale('en-US.json');

  it('finds the dictionaries where the app keeps them', () => {
    expect(localeFiles.length).toBeGreaterThan(0);
    expect(localeFiles).toContain('tr.json');
  });

  it('has at least one provider to check', () => {
    expect(providers.length).toBeGreaterThan(0);
  });

  describe.each(localeFiles)('locale %s', (file) => {
    const dictionary = deepMerge(deepMerge(tr, enUS), loadLocale(file));

    it.each(providers)('resolves every key %s references', (provider) => {
      const missing = manifestKeys(registry.getManifest(provider)).filter(
        (key) => !resolves(dictionary, key),
      );

      // Naming the keys matters: the fix is to add exactly these.
      expect(missing).toEqual([]);
    });

    /**
     * Written but not yet registered — the catalogue still shows them as coming
     * soon. Their translations are checked anyway so that enabling one stays a
     * one-line change instead of turning into a screen full of raw keys.
     */
    it.each(UNREGISTERED)('resolves every key the unregistered %s references', (_name, override) => {
      const missing = (override.credentials ?? [])
        .flatMap(fieldKeys)
        .filter((key) => !resolves(dictionary, key));

      expect(missing).toEqual([]);
    });
  });
});
