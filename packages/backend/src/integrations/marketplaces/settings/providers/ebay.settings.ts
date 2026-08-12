import type { ProviderSettingsOverride } from '@kroptos/shared';
import { EBAY_MARKETPLACES } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.ebay.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;
const option = (key: string, value: string) => `${I}.options.${key}.${value}`;

/**
 * eBay. One integration record per marketplace: category trees, ProductMapping
 * rows, rate limits and connection status are all per-site concerns.
 *
 * `marketplace` sits in `credentials` rather than a settings section for the
 * same reason the Trendyol Global country does — settings are saved after the
 * integration exists, but the connector needs the site on its first call.
 *
 * There is no `sellerId` here: eBay identifies the seller from the OAuth token,
 * not from a field the seller types.
 */
export const ebayOverride: ProviderSettingsOverride = {
  provider: 'ebay',
  displayName: 'eBay',
  capabilities: [
    'orders.read',
    'products.read',
    'stock.push',
    'categories.read',
    'attributes.read',
  ],
  credentials: [
    {
      key: 'marketplace',
      type: 'select',
      labelKey: label('ebay.marketplace'),
      helpKey: help('ebay.marketplace'),
      required: true,
      options: EBAY_MARKETPLACES.map((marketplace) => ({
        value: marketplace.code,
        labelKey: option('ebay.marketplace', marketplace.code),
      })),
    },
    {
      key: 'clientId',
      type: 'text',
      labelKey: cred('clientId'),
      helpKey: cred('clientIdHelp'),
      required: true,
    },
    { key: 'clientSecret', type: 'password', labelKey: cred('clientSecret'), required: true, secret: true },
    {
      key: 'refreshToken',
      type: 'password',
      labelKey: cred('refreshToken'),
      helpKey: cred('refreshTokenHelp'),
      required: true,
      secret: true,
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'EB-' },
    // DOĞRULANAMADI: eBay publishes per-application daily quotas rather than a
    // per-minute figure. Kept conservative until measured.
    'advanced.rateLimitPerMinute': { default: 60 },
  },
  docsUrl: 'https://developer.ebay.com/api-docs/sell/fulfillment/overview.html',
};
