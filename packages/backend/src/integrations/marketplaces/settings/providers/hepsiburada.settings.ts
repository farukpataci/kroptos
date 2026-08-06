import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.hepsiburada.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;
const option = (key: string, value: string) => `${I}.options.${key}.${value}`;

export const hepsiburadaOverride: ProviderSettingsOverride = {
  provider: 'hepsiburada',
  displayName: 'Hepsiburada',
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
    'invoice.upload',
  ],
  credentials: [
    { key: 'merchantId', type: 'text', labelKey: cred('merchantId'), helpKey: cred('merchantIdHelp'), required: true },
    { key: 'apiKey', type: 'password', labelKey: cred('apiKey'), required: true, secret: true },
    { key: 'apiSecret', type: 'password', labelKey: cred('apiSecret'), required: true, secret: true },
  ],
  addSections: [
    {
      tabId: 'catalog',
      section: {
        id: 'hb.listing',
        titleKey: `${I}.sections.hb.listing.title`,
        descriptionKey: `${I}.sections.hb.listing.description`,
        icon: 'TagIcon',
        fields: [
          {
            key: 'hb.listingMode',
            type: 'radioGroup',
            labelKey: label('hb.listingMode'),
            helpKey: help('hb.listingMode'),
            default: 'listing',
            colSpan: 2,
            options: ['listing', 'product'].map((value) => ({
              value,
              labelKey: option('hb.listingMode', value),
            })),
          },
        ],
      },
    },
    {
      tabId: 'fulfillment',
      section: {
        id: 'hb.delivery',
        titleKey: `${I}.sections.hb.delivery.title`,
        icon: 'TruckIcon',
        fields: [
          {
            key: 'hb.deliveryProfileId',
            type: 'resourceSelect',
            labelKey: label('hb.deliveryProfileId'),
            helpKey: help('hb.deliveryProfileId'),
            required: true,
            optionsSource: {
              endpoint: '/integrations/{id}/hepsiburada/delivery-profiles',
              valueField: 'id',
              labelField: 'name',
            },
          },
          {
            key: 'hb.cargoCompanyCode',
            type: 'text',
            labelKey: label('hb.cargoCompanyCode'),
            helpKey: help('hb.cargoCompanyCode'),
            maxLength: 32,
          },
          {
            key: 'hb.fastDelivery',
            type: 'toggle',
            labelKey: label('hb.fastDelivery'),
            default: false,
          },
        ],
      },
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'HB-' },
    'advanced.rateLimitPerMinute': { default: 50 },
  },
  docsUrl: 'https://developers.hepsiburada.com',
};
