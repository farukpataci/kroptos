import type { ProviderSettingsOverride } from '@kroptos/shared';
import { TRENDYOL_GLOBAL_COUNTRIES } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.trendyol_global.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;
const option = (key: string, value: string) => `${I}.options.${key}.${value}`;

/**
 * Trendyol's international storefronts. One integration record per country:
 * category trees, ProductMapping rows, rate limits and connection status are
 * all per-country concerns that cannot share a record.
 *
 * `country` sits in `credentials` rather than in a settings section on purpose.
 * Settings are saved *after* the integration exists, but the connector needs
 * the storefront on its very first call — the connection test. Collecting it
 * with the credentials means `MarketplaceCredentialService.validate()` rejects
 * a country-less create before anything is persisted.
 */
export const trendyolGlobalOverride: ProviderSettingsOverride = {
  provider: 'trendyol_global',
  displayName: 'Trendyol Global',
  capabilities: [
    'orders.read',
    'orders.updateStatus',
    'products.push',
    'products.read',
    'stock.push',
    'price.push',
    'categories.read',
    'attributes.read',
  ],
  credentials: [
    {
      key: 'country',
      type: 'select',
      labelKey: label('trendyol_global.country'),
      helpKey: help('trendyol_global.country'),
      required: true,
      options: TRENDYOL_GLOBAL_COUNTRIES.map((country) => ({
        value: country.code,
        labelKey: option('trendyol_global.country', country.code),
      })),
    },
    {
      key: 'sellerId',
      type: 'text',
      labelKey: cred('sellerId'),
      helpKey: cred('sellerIdHelp'),
      required: true,
      pattern: '^[0-9]+$',
    },
    { key: 'apiKey', type: 'password', labelKey: cred('apiKey'), required: true, secret: true },
    { key: 'apiSecret', type: 'password', labelKey: cred('apiSecret'), required: true, secret: true },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'TYG-' },
    // DOĞRULANAMADI: whether the international gateway publishes a different
    // quota than the Türkiye one. Same value until measured.
    'advanced.rateLimitPerMinute': { default: 100 },
  },
  docsUrl: 'https://developers.trendyol.com/int/docs/intro',
};
