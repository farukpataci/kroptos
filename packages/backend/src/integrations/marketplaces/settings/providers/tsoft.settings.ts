import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.tsoft.${key}`;

export const tsoftOverride: ProviderSettingsOverride = {
  provider: 'tsoft',
  displayName: 'T-Soft',
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
      key: 'username',
      type: 'text',
      labelKey: cred('username'),
      helpKey: cred('usernameHelp'),
      placeholderKey: cred('usernamePlaceholder'),
      required: true,
    },
    {
      key: 'password',
      type: 'password',
      labelKey: cred('password'),
      helpKey: cred('passwordHelp'),
      required: true,
      secret: true,
    },
  ],
};
