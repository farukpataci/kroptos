import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.shopify.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;

export const shopifyOverride: ProviderSettingsOverride = {
  provider: 'shopify',
  displayName: 'Shopify',
  capabilities: [
    'orders.read',
    'products.read',
    'stock.push',
  ],
  credentials: [
    { key: 'accessToken', type: 'password', labelKey: cred('accessToken'), helpKey: cred('accessTokenHelp'), required: true, secret: true },
  ],
  addSections: [
    {
      tabId: 'general',
      section: {
        id: 'shopify.general',
        titleKey: `${I}.sections.shopify.general.title`,
        descriptionKey: `${I}.sections.shopify.general.description`,
        icon: 'GlobeAltIcon',
        fields: [
          {
            key: 'general.shopDomain',
            type: 'text',
            labelKey: label('general.shopDomain'),
            helpKey: help('general.shopDomain'),
            required: true,
            placeholderKey: `${I}.placeholders.general.shopDomain`,
          },
        ],
      },
    },
  ],
};
