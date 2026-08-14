import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.etsy.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;
const option = (key: string, value: string) => `${I}.options.${key}.${value}`;

export const etsyOverride: ProviderSettingsOverride = {
  provider: 'etsy',
  displayName: 'Etsy Global',
  // Etsy has no buybox, publishes no commission endpoint and prints its own
  // shipping labels, so those capabilities stay off.
  capabilities: [
    'orders.read',
    'orders.updateStatus',
    'products.push',
    'products.read',
    'stock.push',
    'price.push',
    'categories.read',
    'attributes.read',
    'shipment.track',
    'returns.read',
  ],
  /**
   * Etsy authenticates with OAuth2. Rather than running a browser consent flow,
   * the seller pastes a refresh token obtained once from their Etsy app; the
   * connector exchanges it for a short-lived access token on every run.
   */
  credentials: [
    { key: 'keystring', type: 'text', labelKey: cred('keystring'), helpKey: cred('keystringHelp'), required: true },
    {
      key: 'refreshToken',
      type: 'password',
      labelKey: cred('refreshToken'),
      helpKey: cred('refreshTokenHelp'),
      required: true,
      secret: true,
    },
    { key: 'shopId', type: 'text', labelKey: cred('shopId'), helpKey: cred('shopIdHelp'), required: true, pattern: '^[0-9]+$' },
  ],
  // Etsy generates its own invoices and labels for the seller.
  omitFields: ['fulfillment.labelSource', 'invoicing.uploadToMarketplace'],
  addSections: [
    {
      tabId: 'catalog',
      section: {
        id: 'etsy.listing',
        titleKey: `${I}.sections.etsy.listing.title`,
        descriptionKey: `${I}.sections.etsy.listing.description`,
        icon: 'TagIcon',
        fields: [
          {
            key: 'etsy.listingState',
            type: 'select',
            labelKey: label('etsy.listingState'),
            helpKey: help('etsy.listingState'),
            default: 'active',
            options: ['active', 'draft', 'inactive'].map((value) => ({
              value,
              labelKey: option('etsy.listingState', value),
            })),
          },
        ],
      },
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'ETSY-' },
    // Etsy's default shop currency is rarely TRY; the seller picks their own.
    'general.currency': { default: 'USD' },
    'advanced.rateLimitPerMinute': { default: 60 },
  },
  docsUrl: 'https://developers.etsy.com/documentation',
};
