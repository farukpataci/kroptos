import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.ideasoft.${key}`;

export const ideasoftOverride: ProviderSettingsOverride = {
  provider: 'ideasoft',
  displayName: 'İdeaSoft',
  capabilities: [
    'orders.read',
    'orders.updateStatus',
    'products.read',
    'stock.push',
    'categories.read',
  ],
  credentials: [
    {
      key: 'storeDomain',
      type: 'text',
      labelKey: cred('storeDomain'),
      helpKey: cred('storeDomainHelp'),
      placeholderKey: cred('storeDomainPlaceholder'),
      required: true,
    },
    {
      key: 'accessToken',
      type: 'password',
      labelKey: cred('accessToken'),
      helpKey: cred('accessTokenHelp'),
      required: false,
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
