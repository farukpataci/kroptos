import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.ciceksepeti.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;
const option = (key: string, value: string) => `${I}.options.${key}.${value}`;

const choices = (key: string, values: string[]) =>
  values.map((value) => ({ value, labelKey: option(key, value) }));

export const ciceksepetiOverride: ProviderSettingsOverride = {
  provider: 'ciceksepeti',
  displayName: 'ÇiçekSepeti',
  capabilities: [
    'orders.read',
    'orders.updateStatus',
    'products.push',
    'products.read',
    'stock.push',
    'price.push',
    'categories.read',
  ],
  credentials: [
    { key: 'apiKey', type: 'password', labelKey: cred('apiKey'), helpKey: cred('apiKeyHelp'), required: true, secret: true },
  ],
  // ÇiçekSepeti caps listings at 5 images, so the limit is not a user choice.
  omitFields: ['catalog.maxImages'],
  addSections: [
    {
      tabId: 'fulfillment',
      section: {
        id: 'cs.delivery',
        titleKey: `${I}.sections.cs.delivery.title`,
        descriptionKey: `${I}.sections.cs.delivery.description`,
        icon: 'TruckIcon',
        fields: [
          {
            key: 'cs.deliveryType',
            type: 'radioGroup',
            labelKey: label('cs.deliveryType'),
            helpKey: help('cs.deliveryType'),
            default: 'standard',
            required: true,
            colSpan: 2,
            options: choices('cs.deliveryType', ['sameDay', 'standard']),
          },
          {
            key: 'cs.deliveryCities',
            type: 'multiselect',
            labelKey: label('cs.deliveryCities'),
            helpKey: help('cs.deliveryCities'),
            colSpan: 2,
            visibleWhen: { field: 'cs.deliveryType', op: 'eq', value: 'sameDay' },
            options: choices('cs.deliveryCities', [
              'istanbul',
              'ankara',
              'izmir',
              'bursa',
              'antalya',
              'adana',
            ]),
          },
          {
            key: 'cs.preparationHours',
            type: 'number',
            labelKey: label('cs.preparationHours'),
            helpKey: help('cs.preparationHours'),
            default: 4,
            min: 1,
            max: 72,
            unitKey: `${I}.units.hours`,
          },
        ],
      },
    },
    {
      tabId: 'catalog',
      section: {
        id: 'cs.gifting',
        titleKey: `${I}.sections.cs.gifting.title`,
        icon: 'GiftIcon',
        fields: [
          {
            key: 'cs.messageCardSupport',
            type: 'toggle',
            labelKey: label('cs.messageCardSupport'),
            helpKey: help('cs.messageCardSupport'),
            default: true,
            colSpan: 2,
          },
        ],
      },
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'CS-' },
    'advanced.rateLimitPerMinute': { default: 100 },
  },
  docsUrl: 'https://apidocs.ciceksepeti.com',
};
