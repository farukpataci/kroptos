import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.pazarama.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;

export const pazaramaOverride: ProviderSettingsOverride = {
  provider: 'pazarama',
  displayName: 'Pazarama',
  // Pazarama's merchant API covers catalogue and order flow but publishes no
  // buybox, commission or shipping-label endpoints, so those stay off.
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
  // The token endpoint takes these two as an OAuth2 client-credentials pair.
  credentials: [
    {
      key: 'apiKey',
      type: 'text',
      labelKey: cred('apiKey'),
      helpKey: cred('apiKeyHelp'),
      required: true,
    },
    { key: 'secretKey', type: 'password', labelKey: cred('secretKey'), required: true, secret: true },
  ],
  // Pazarama prints its own shipping label from the seller panel.
  omitFields: ['fulfillment.labelSource'],
  addSections: [
    {
      tabId: 'catalog',
      section: {
        id: 'pazarama.listing',
        titleKey: `${I}.sections.pazarama.listing.title`,
        descriptionKey: `${I}.sections.pazarama.listing.description`,
        icon: 'TagIcon',
        fields: [
          {
            key: 'pazarama.onlyApprovedProducts',
            type: 'toggle',
            labelKey: label('pazarama.onlyApprovedProducts'),
            helpKey: help('pazarama.onlyApprovedProducts'),
            default: true,
          },
        ],
      },
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'PZR-' },
    'advanced.rateLimitPerMinute': { default: 60 },
  },
  docsUrl: 'https://isortagimapi.pazarama.com',
};
