import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.n11.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;

export const n11Override: ProviderSettingsOverride = {
  provider: 'n11',
  displayName: 'n11',
  capabilities: [
    'orders.read',
    'orders.updateStatus',
    'products.push',
    'products.read',
    'stock.push',
    'price.push',
    'categories.read',
    'attributes.read',
    'returns.read',
  ],
  credentials: [
    { key: 'apiKey', type: 'password', labelKey: cred('apiKey'), required: true, secret: true },
    { key: 'apiSecret', type: 'password', labelKey: cred('apiSecret'), required: true, secret: true },
  ],
  // n11 prints no marketplace label, so the whole label-source choice goes away
  // rather than offering an option that silently does nothing.
  omitFields: ['fulfillment.labelSource'],
  addSections: [
    {
      tabId: 'fulfillment',
      section: {
        id: 'n11.shipment',
        titleKey: `${I}.sections.n11.shipment.title`,
        descriptionKey: `${I}.sections.n11.shipment.description`,
        icon: 'TruckIcon',
        fields: [
          {
            key: 'n11.shipmentTemplate',
            type: 'text',
            labelKey: label('n11.shipmentTemplate'),
            helpKey: help('n11.shipmentTemplate'),
            required: true,
            maxLength: 64,
          },
          {
            key: 'n11.preparingDay',
            type: 'number',
            labelKey: label('n11.preparingDay'),
            helpKey: help('n11.preparingDay'),
            default: 1,
            min: 1,
            max: 7,
            unitKey: `${I}.units.days`,
          },
        ],
      },
    },
    {
      tabId: 'catalog',
      section: {
        id: 'n11.catalog',
        titleKey: `${I}.sections.n11.catalog.title`,
        icon: 'TagIcon',
        fields: [
          {
            key: 'n11.catalogMatch',
            type: 'toggle',
            labelKey: label('n11.catalogMatch'),
            helpKey: help('n11.catalogMatch'),
            default: true,
            colSpan: 2,
          },
        ],
      },
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'N11-' },
    'advanced.rateLimitPerMinute': { default: 100 },
  },
  docsUrl: 'https://api.n11.com',
};
