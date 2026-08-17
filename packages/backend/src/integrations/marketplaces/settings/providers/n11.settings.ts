import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.n11.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;

export const n11Override: ProviderSettingsOverride = {
  provider: 'n11',
  displayName: 'n11',
  /**
   * Unchanged, and deliberately so: `catalog`, `stock`, `pricing` and `returns`
   * are gated on `products.push`, `stock.push`, `price.push` and `returns.read`,
   * so trimming this list would delete those tabs and prune every value a seller
   * had saved inside them — including the stock buffer and cap, which the sync
   * worker reads for every provider.
   */
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
  /**
   * Of the nine above, these five have no working implementation: the connector
   * has no status push, no product push and no price push at all, and its stock
   * push has no confirmed endpoint. Only `/cdn/categories` and
   * `/cdn/category/{id}/attribute` are verified live; orders and products come
   * from sample data in simulation mode and refuse outright in live mode.
   *
   * The UI reads this to stop presenting them as working features.
   */
  plannedCapabilities: ['orders.updateStatus', 'products.push', 'stock.push', 'price.push', 'returns.read'],
  credentials: [
    { key: 'apiKey', type: 'password', labelKey: cred('apiKey'), required: true, secret: true },
    { key: 'apiSecret', type: 'password', labelKey: cred('apiSecret'), required: true, secret: true },
  ],
  // n11 prints no marketplace label, so the whole label-source choice goes away
  // rather than offering an option that silently does nothing.
  omitFields: ['fulfillment.labelSource'],
  addSections: [
    {
      tabId: 'general',
      position: 'start',
      section: {
        id: 'n11.mode',
        titleKey: `${I}.sections.n11.mode.title`,
        descriptionKey: `${I}.sections.n11.mode.description`,
        icon: 'BeakerIcon',
        fields: [
          {
            key: 'general.mode',
            type: 'select',
            labelKey: label('general.mode'),
            helpKey: help('general.mode'),
            // 'auto' rather than a concrete mode on purpose: a stored 'live' or
            // 'simulation' outranks MARKETPLACE_MODE, so a default here would
            // make the environment variable unreachable forever.
            default: 'auto',
            options: [
              { value: 'auto', labelKey: `${I}.options.general.mode.auto` },
              { value: 'simulation', labelKey: `${I}.options.general.mode.simulation` },
              { value: 'live', labelKey: `${I}.options.general.mode.live` },
            ],
            colSpan: 2,
          },
        ],
      },
    },
    {
      tabId: 'fulfillment',
      section: {
        id: 'n11.shipment',
        titleKey: `${I}.sections.n11.shipment.title`,
        descriptionKey: `${I}.sections.n11.shipment.description`,
        icon: 'TruckIcon',
        fields: [
          // Both fields feed a product/shipment push that has no confirmed
          // endpoint, so the connector reads neither. They stay in the manifest
          // — deleting them would prune whatever a seller already saved and make
          // a save that echoes the key back fail as unknown — but `deprecated`
          // keeps them off the screen, and `required` is gone so the wizard is
          // no longer gated on a value nothing consumes.
          {
            key: 'n11.shipmentTemplate',
            type: 'text',
            labelKey: label('n11.shipmentTemplate'),
            helpKey: help('n11.shipmentTemplate'),
            deprecated: true,
            maxLength: 64,
          },
          {
            key: 'n11.preparingDay',
            type: 'number',
            labelKey: label('n11.preparingDay'),
            helpKey: help('n11.preparingDay'),
            deprecated: true,
            default: 1,
            min: 1,
            max: 7,
            unitKey: `${I}.units.days`,
          },
        ],
      },
    },
    {
      tabId: 'catalog',
      section: {
        id: 'n11.catalog',
        titleKey: `${I}.sections.n11.catalog.title`,
        icon: 'TagIcon',
        fields: [
          {
            key: 'n11.catalogMatch',
            type: 'toggle',
            labelKey: label('n11.catalogMatch'),
            helpKey: help('n11.catalogMatch'),
            deprecated: true,
            default: true,
            colSpan: 2,
          },
        ],
      },
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'N11-' },
    'advanced.rateLimitPerMinute': { default: 100 },
  },
  docsUrl: 'https://api.n11.com',
};
