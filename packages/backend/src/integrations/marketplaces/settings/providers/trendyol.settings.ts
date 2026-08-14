import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.trendyol.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;
const option = (key: string, value: string) => `${I}.options.${key}.${value}`;

export const trendyolOverride: ProviderSettingsOverride = {
  provider: 'trendyol',
  displayName: 'Trendyol',
  capabilities: [
    'orders.read',
    'orders.updateStatus',
    'products.push',
    'products.read',
    'stock.push',
    'price.push',
    'categories.read',
    'attributes.read',
    'shipment.label',
    'returns.read',
    'commission.read',
    'buybox.read',
  ],
  // Mirrors MarketplaceCredentialService's former hard-coded required keys.
  credentials: [
    { key: 'sellerId', type: 'text', labelKey: cred('sellerId'), helpKey: cred('sellerIdHelp'), required: true, pattern: '^[0-9]+$' },
    { key: 'apiKey', type: 'password', labelKey: cred('apiKey'), required: true, secret: true },
    { key: 'apiSecret', type: 'password', labelKey: cred('apiSecret'), required: true, secret: true },
  ],
  // No storefront selector: this provider is Türkiye. Selling on an
  // international storefront is the `trendyol_global` provider, which gets its
  // own integration record per country so that category mappings, rate limits
  // and connection status stay separated.
  addSections: [
    {
      tabId: 'fulfillment',
      section: {
        id: 'trendyol.shipment',
        titleKey: `${I}.sections.trendyol.shipment.title`,
        descriptionKey: `${I}.sections.trendyol.shipment.description`,
        icon: 'TruckIcon',
        fields: [
          {
            key: 'trendyol.shipmentAddressId',
            type: 'resourceSelect',
            labelKey: label('trendyol.shipmentAddressId'),
            helpKey: help('trendyol.shipmentAddressId'),
            required: true,
            optionsSource: {
              endpoint: '/integrations/{id}/trendyol/addresses',
              valueField: 'id',
              labelField: 'label',
            },
          },
          {
            key: 'trendyol.returnAddressId',
            type: 'resourceSelect',
            labelKey: label('trendyol.returnAddressId'),
            required: true,
            optionsSource: {
              endpoint: '/integrations/{id}/trendyol/addresses',
              valueField: 'id',
              labelField: 'label',
            },
          },
          {
            key: 'trendyol.fastDelivery',
            type: 'toggle',
            labelKey: label('trendyol.fastDelivery'),
            helpKey: help('trendyol.fastDelivery'),
            default: false,
          },
          {
            key: 'trendyol.buyboxStrategy',
            type: 'select',
            labelKey: label('trendyol.buyboxStrategy'),
            helpKey: help('trendyol.buyboxStrategy'),
            default: 'off',
            requiresCapability: 'buybox.read',
            options: ['off', 'matchLowest', 'minMargin'].map((value) => ({
              value,
              labelKey: option('trendyol.buyboxStrategy', value),
            })),
          },
        ],
      },
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'TY-' },
    'advanced.rateLimitPerMinute': { default: 100 },
  },
  docsUrl: 'https://developers.trendyol.com',
};
