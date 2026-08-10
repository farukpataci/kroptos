'use client';

import { useTranslations } from 'next-intl';

/**
 * Turns a message key into something readable when the dictionary has no entry
 * for it.
 *
 * `integrations.settings.fields.trendyol_global.country.label` → `Country`.
 * The trailing role segment (`label`, `help`, …) names the slot, not the field,
 * so the segment before it is the one worth showing.
 *
 * This is cosmetic damage control, not protection: a missing key is a bug, and
 * `manifest.i18n.spec.ts` is what actually keeps them from shipping. This only
 * decides what a user sees on the day one slips through — "Country" beats
 * "INTEGRATIONS.SETTINGS.FIELDS.TRENDYOL_GLOBAL.COUNTRY.LABEL".
 */
const ROLE_SEGMENTS = new Set(['label', 'help', 'description', 'title', 'placeholder', 'unit']);

export function humanizeMessageKey(key: string): string {
  const segments = key.split('.').filter(Boolean);
  if (segments.length === 0) return key;

  let candidate = segments[segments.length - 1];
  if (ROLE_SEGMENTS.has(candidate) && segments.length > 1) {
    candidate = segments[segments.length - 2];
  }

  const spaced = candidate
    // camelCase → camel Case
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * `t` with a fallback. next-intl renders the raw key for a missing message and
 * shouts it in the console; `t.has` lets us answer with something legible
 * instead.
 */
export function useFieldText() {
  const t = useTranslations();

  return (key: string | undefined): string => {
    if (!key) return '';
    return t.has(key) ? t(key) : humanizeMessageKey(key);
  };
}
