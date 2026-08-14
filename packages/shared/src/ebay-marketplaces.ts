/**
 * eBay sites an integration can be pointed at, sent as the
 * `X-EBAY-C-MARKETPLACE-ID` header on every Sell API call.
 *
 * THIS IS A VERIFIED SUBSET AND IS INCOMPLETE. eBay operates many more sites
 * (EBAY_AU, EBAY_CA, EBAY_FR, EBAY_IT, EBAY_ES…), but only the three below were
 * confirmed against eBay's documentation while this was written. A marketplace
 * id that looks plausible but is wrong is rejected by the gateway, or worse
 * silently scopes the call to the wrong site — so unconfirmed ids are left out
 * rather than guessed.
 *
 * Adding one is a single line here; nothing else changes. The manifest builds
 * its select options from this list and the connector validates against it, so
 * there is no second place to update.
 *
 * DOĞRULANAMADI: the full supported list.
 */
export interface EbayMarketplace {
  /** Value sent as the `X-EBAY-C-MARKETPLACE-ID` header. */
  code: string;
  /** Display name; the manifest pairs it with an i18n key. */
  name: string;
}

export const EBAY_MARKETPLACES: readonly EbayMarketplace[] = [
  { code: 'EBAY_US', name: 'Amerika Birleşik Devletleri' },
  { code: 'EBAY_GB', name: 'Birleşik Krallık' },
  { code: 'EBAY_DE', name: 'Almanya' },
] as const;

export const EBAY_MARKETPLACE_CODES: readonly string[] = EBAY_MARKETPLACES.map((m) => m.code);

export function isEbayMarketplace(value: unknown): boolean {
  return typeof value === 'string' && EBAY_MARKETPLACE_CODES.includes(value.toUpperCase());
}

/** Display name for a code, or the code itself when it is not in the list. */
export function ebayMarketplaceName(code: string): string {
  return EBAY_MARKETPLACES.find((m) => m.code === code.toUpperCase())?.name ?? code.toUpperCase();
}
