import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.ticimax.${key}`;

export const ticimaxOverride: ProviderSettingsOverride = {
  provider: 'ticimax',
  displayName: 'Ticimax',
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
      key: 'uyeKodu',
      type: 'password',
      labelKey: cred('uyeKodu'),
      helpKey: cred('uyeKoduHelp'),
      required: true,
      secret: true,
    },
  ],
};
