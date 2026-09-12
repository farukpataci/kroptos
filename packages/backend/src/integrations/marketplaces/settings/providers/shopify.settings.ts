import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.shopify.${key}`;

export const shopifyOverride: ProviderSettingsOverride = {
  provider: 'shopify',
  displayName: 'Shopify',
  capabilities: [
    'orders.read',
    'orders.updateStatus',
    'products.read',
    'products.push',
    'stock.push',
    'price.push',
    'shipment.track',
  ],
  credentials: [
    {
      key: 'shopDomain',
      type: 'text',
      labelKey: cred('shopDomain'),
      helpKey: cred('shopDomainHelp'),
      required: true,
    },
    {
      key: 'accessToken',
      type: 'password',
      labelKey: cred('accessToken'),
      helpKey: cred('accessTokenHelp'),
      required: true,
      secret: true,
    },
  ],
  omitFields: ['invoicing.uploadToMarketplace'],
};
