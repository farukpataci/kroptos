/**
 * Storefronts the `trendyol_global` provider can be pointed at.
 *
 * THIS IS A VERIFIED SUBSET AND IS PROBABLY INCOMPLETE. Trendyol operates in
 * more countries than are listed here (Azerbaijan, Germany and the 2024 CEE
 * launches among them), but only the codes below appear as `storeFrontCode`
 * values in Trendyol's own integration documentation. A code that looks
 * plausible but is wrong fails as a 404 or, worse, silently returns another
 * storefront's data — so unverified codes are left out rather than guessed.
 *
 * Adding one is a single line here; nothing else needs to change. The manifest
 * builds its select options from this list and the connector validates against
 * it, so there is no second place to update.
 *
 * DOĞRULANAMADI: the full supported list. developers.trendyol.com/int/docs
 * returns 403 to automated fetches, so this was assembled from documentation
 * excerpts. Confirm against the seller panel before relying on it.
 */
export interface TrendyolGlobalCountry {
  /** Value sent as the `storeFrontCode` header. */
  code: string;
  /** Display name; the manifest pairs it with an i18n key. */
  name: string;
}

export const TRENDYOL_GLOBAL_COUNTRIES: readonly TrendyolGlobalCountry[] = [
  { code: 'SA', name: 'Suudi Arabistan' },
  { code: 'AE', name: 'Birleşik Arap Emirlikleri' },
  { code: 'KW', name: 'Kuveyt' },
  { code: 'RO', name: 'Romanya' },
  { code: 'GR', name: 'Yunanistan' },
] as const;

export const TRENDYOL_GLOBAL_COUNTRY_CODES: readonly string[] = TRENDYOL_GLOBAL_COUNTRIES.map(
  (country) => country.code,
);

export function isTrendyolGlobalCountry(value: unknown): boolean {
  return typeof value === 'string' && TRENDYOL_GLOBAL_COUNTRY_CODES.includes(value.toUpperCase());
}

/** Display name for a code, or the code itself when it is not in the list. */
export function trendyolGlobalCountryName(code: string): string {
  return (
    TRENDYOL_GLOBAL_COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ?? code.toUpperCase()
  );
}
