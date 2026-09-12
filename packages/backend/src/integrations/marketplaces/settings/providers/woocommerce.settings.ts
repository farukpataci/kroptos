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
    'orders.updateStatus',
    'products.read',
    'products.push',
    'stock.push',
    'price.push',
    'categories.read',
  ],
  credentials: [
    {
      key: 'baseUrl',
      type: 'text',
      labelKey: cred('baseUrl'),
      helpKey: cred('baseUrlHelp'),
      required: true,
      placeholderKey: cred('baseUrlPlaceholder'),
    },
    {
      key: 'consumerKey',
      type: 'password',
      labelKey: cred('consumerKey'),
      helpKey: cred('consumerKeyHelp'),
      required: true,
      secret: true,
    },
    {
      key: 'consumerSecret',
      type: 'password',
      labelKey: cred('consumerSecret'),
      helpKey: cred('consumerSecretHelp'),
      required: true,
      secret: true,
    },
    {
      key: 'webhookSecret',
      type: 'password',
      labelKey: cred('webhookSecret'),
      helpKey: cred('webhookSecretHelp'),
      required: false,
      secret: true,
    },
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
            required: false,
            placeholderKey: `${I}.placeholders.general.shopUrl`,
          },
        ],
      },
    },
  ],
};
