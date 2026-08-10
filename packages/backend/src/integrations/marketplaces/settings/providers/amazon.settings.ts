import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.amazon.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;
const option = (key: string, value: string) => `${I}.options.${key}.${value}`;

const choices = (key: string, values: string[]) =>
  values.map((value) => ({ value, labelKey: option(key, value) }));

export const amazonOverride: ProviderSettingsOverride = {
  provider: 'amazon',
  displayName: 'Amazon',
  capabilities: [
    'orders.read',
    'orders.updateStatus',
    'orders.cancel',
    'products.push',
    'products.read',
    'stock.push',
    'price.push',
    'categories.read',
    'shipment.label',
    'shipment.track',
    'returns.read',
  ],
  // SP-API authenticates with Login with Amazon: clientId + clientSecret exchange
  // the refresh token for a short-lived access token. The AWS key pair below was
  // only ever needed for SigV4 request signing, which Amazon stopped requiring;
  // it stays optional so already-saved integrations keep validating.
  credentials: [
    { key: 'sellerId', type: 'text', labelKey: cred('sellerId'), helpKey: cred('sellerIdHelp'), required: true },
    { key: 'clientId', type: 'text', labelKey: cred('clientId'), helpKey: cred('clientIdHelp'), required: true },
    { key: 'clientSecret', type: 'password', labelKey: cred('clientSecret'), required: true, secret: true },
    { key: 'refreshToken', type: 'password', labelKey: cred('refreshToken'), required: true, secret: true },
    { key: 'awsAccessKey', type: 'password', labelKey: cred('awsAccessKey'), required: false, secret: true },
    { key: 'awsSecretKey', type: 'password', labelKey: cred('awsSecretKey'), required: false, secret: true },
  ],
  // Amazon issues its own invoices through VAT Calculation Service; pushing
  // ours would produce duplicates.
  omitFields: ['invoicing.uploadToMarketplace'],
  addSections: [
    {
      tabId: 'general',
      section: {
        id: 'amazon.region',
        titleKey: `${I}.sections.amazon.region.title`,
        descriptionKey: `${I}.sections.amazon.region.description`,
        icon: 'GlobeAltIcon',
        fields: [
          {
            key: 'amazon.region',
            type: 'select',
            labelKey: label('amazon.region'),
            helpKey: help('amazon.region'),
            default: 'eu',
            required: true,
            options: choices('amazon.region', ['eu', 'na', 'fe']),
          },
          {
            key: 'amazon.marketplaceIds',
            type: 'multiselect',
            labelKey: label('amazon.marketplaceIds'),
            helpKey: help('amazon.marketplaceIds'),
            required: true,
            colSpan: 2,
            options: choices('amazon.marketplaceIds', [
              'A1UNQM1SR2CHM', // TR
              'A1PA6795UKMFR9', // DE
              'A1RKKUPIHCS9HS', // ES
              'A13V1IB3VIYZZH', // FR
              'APJ6JRA9NG5V4', // IT
              'A1F83G8C2ARO7P', // UK
              'ATVPDKIKX0DER', // US
            ]),
          },
        ],
      },
    },
    {
      tabId: 'fulfillment',
      section: {
        id: 'amazon.fulfillment',
        titleKey: `${I}.sections.amazon.fulfillment.title`,
        icon: 'TruckIcon',
        fields: [
          {
            key: 'amazon.fulfillmentChannel',
            type: 'radioGroup',
            labelKey: label('amazon.fulfillmentChannel'),
            helpKey: help('amazon.fulfillmentChannel'),
            default: 'FBM',
            colSpan: 2,
            options: choices('amazon.fulfillmentChannel', ['FBA', 'FBM']),
          },
          {
            key: 'amazon.mfnShippingTemplate',
            type: 'text',
            labelKey: label('amazon.mfnShippingTemplate'),
            helpKey: help('amazon.mfnShippingTemplate'),
            maxLength: 64,
            visibleWhen: { field: 'amazon.fulfillmentChannel', op: 'eq', value: 'FBM' },
          },
        ],
      },
    },
    {
      tabId: 'catalog',
      section: {
        id: 'amazon.feed',
        titleKey: `${I}.sections.amazon.feed.title`,
        icon: 'ArrowUpTrayIcon',
        fields: [
          {
            key: 'amazon.feedType',
            type: 'select',
            labelKey: label('amazon.feedType'),
            helpKey: help('amazon.feedType'),
            default: 'JSON_LISTINGS_FEED',
            options: choices('amazon.feedType', [
              'JSON_LISTINGS_FEED',
              'POST_PRODUCT_DATA',
              'POST_INVENTORY_AVAILABILITY_DATA',
            ]),
          },
        ],
      },
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'AMZ-' },
    'general.currency': { default: 'EUR' },
    'advanced.rateLimitPerMinute': { default: 20 },
  },
  docsUrl: 'https://developer-docs.amazon.com/sp-api',
};
