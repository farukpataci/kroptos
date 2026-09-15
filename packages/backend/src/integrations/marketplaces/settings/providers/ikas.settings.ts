import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.ikas.${key}`;

export const ikasOverride: ProviderSettingsOverride = {
  provider: 'ikas',
  displayName: 'İkas',
  capabilities: [
    'orders.read',
    'orders.updateStatus',
    'products.read',
    'stock.push',
    'categories.read',
  ],
  credentials: [
    {
      key: 'storeUrl',
      type: 'text',
      labelKey: cred('storeUrl'),
      helpKey: cred('storeUrlHelp'),
      placeholderKey: cred('storeUrlPlaceholder'),
      required: true,
    },
    {
      key: 'apiToken',
      type: 'password',
      labelKey: cred('apiToken'),
      helpKey: cred('apiTokenHelp'),
      required: true,
      secret: true,
    },
    {
      key: 'clientId',
      type: 'text',
      labelKey: cred('clientId'),
      helpKey: cred('clientIdHelp'),
      required: false,
      secret: false,
    },
    {
      key: 'clientSecret',
      type: 'password',
      labelKey: cred('clientSecret'),
      helpKey: cred('clientSecretHelp'),
      required: false,
      secret: true,
    },
  ],
};
