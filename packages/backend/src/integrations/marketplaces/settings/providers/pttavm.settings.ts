import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.pttavm.${key}`;

export const pttavmOverride: ProviderSettingsOverride = {
  provider: 'pttavm',
  displayName: 'PttAVM',
  // PttAVM publishes no buybox or commission endpoint, and its shipping is
  // handled by PTT itself, so no label source to choose.
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
    { key: 'apiKey', type: 'text', labelKey: cred('apiKey'), helpKey: cred('apiKeyHelp'), required: true },
    { key: 'apiSecret', type: 'password', labelKey: cred('apiSecret'), required: true, secret: true },
  ],
  // PTT prints the shipping label; the seller never chooses a source.
  omitFields: ['fulfillment.labelSource'],
  patchFields: {
    'orders.numberPrefix': { default: 'PTT-' },
    'advanced.rateLimitPerMinute': { default: 60 },
  },
  docsUrl: 'https://www.pttavm.com',
};
