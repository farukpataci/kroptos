import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.idefix.${key}`;

export const idefixOverride: ProviderSettingsOverride = {
  provider: 'idefix',
  displayName: 'idefix',
  // idefix runs no buybox and publishes no commission endpoint.
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
  ],
  // Every call is scoped by the vendor id, so it is a credential rather than a
  // setting: without it no request can be addressed at all.
  credentials: [
    { key: 'vendorId', type: 'text', labelKey: cred('vendorId'), helpKey: cred('vendorIdHelp'), required: true },
    { key: 'apiKey', type: 'text', labelKey: cred('apiKey'), required: true },
    { key: 'apiSecret', type: 'password', labelKey: cred('apiSecret'), required: true, secret: true },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'IDF-' },
    'advanced.rateLimitPerMinute': { default: 60 },
  },
  docsUrl: 'https://www.idefix.com',
};
