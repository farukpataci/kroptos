import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.woocommerce.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;

export const woocommerceOverride: ProviderSettingsOverride = {
  provider: 'woocommerce',
  displayName: 'WooCommerce',
  capabilities: [
    'orders.read',
    'products.read',
    'stock.push',
    'categories.read',
  ],
  credentials: [
    { key: 'consumerKey', type: 'password', labelKey: cred('consumerKey'), helpKey: cred('consumerKeyHelp'), required: true, secret: true },
    { key: 'consumerSecret', type: 'password', labelKey: cred('consumerSecret'), helpKey: cred('consumerSecretHelp'), required: true, secret: true },
  ],
  addSections: [
    {
      tabId: 'general',
      section: {
        id: 'woocommerce.general',
        titleKey: `${I}.sections.woocommerce.general.title`,
        descriptionKey: `${I}.sections.woocommerce.general.description`,
        icon: 'GlobeAltIcon',
        fields: [
          {
            key: 'general.shopUrl',
            type: 'text',
            labelKey: label('general.shopUrl'),
            helpKey: help('general.shopUrl'),
            required: true,
            placeholderKey: `${I}.placeholders.general.shopUrl`,
          },
        ],
      },
    },
  ],
};
