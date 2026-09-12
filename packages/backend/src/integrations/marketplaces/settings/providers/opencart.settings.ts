import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.opencart.${key}`;

export const opencartOverride: ProviderSettingsOverride = {
  provider: 'opencart',
  displayName: 'OpenCart',
  capabilities: [
    'orders.read',
    'orders.updateStatus',
    'products.read',
    'stock.push',
    'categories.read',
  ],
  credentials: [
    {
      key: 'url',
      type: 'text',
      labelKey: cred('url'),
      helpKey: cred('urlHelp'),
      placeholderKey: cred('urlPlaceholder'),
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
      key: 'apiKey',
      type: 'password',
      labelKey: cred('apiKey'),
      helpKey: cred('apiKeyHelp'),
      required: true,
      secret: true,
    },
  ],
};
