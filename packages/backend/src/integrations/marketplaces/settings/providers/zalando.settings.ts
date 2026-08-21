import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.zalando.${key}`;

/**
 * Zalando zDirect partner platform.
 *
 * NOT REGISTERED YET — deliberately absent from `OVERRIDES`, which keeps the
 * catalogue card on "coming soon". Authentication is verified first-hand
 * against Zalando's published spec, and the order and stock calls are now
 * written against the zDirect OpenAPI documents for those APIs. What is still
 * missing is a run against a real merchant account: those two specs came from a
 * public mirror because Zalando serves only the authentication one, so nothing
 * here has been proven against the live API.
 *
 * Enabling it is one line in `manifest.registry.ts`. See
 * docs/plans/zalando-integration.md for the verification order.
 *
 * `merchantId` and `salesChannelId` are credentials rather than settings
 * fields because both are needed on the connector's first business call, and
 * settings are only saved after the integration exists. Collecting them here
 * means `MarketplaceCredentialService.validate()` rejects an incomplete create
 * before anything is persisted.
 *
 * One integration record per sales channel, the same rule as Trendyol Global's
 * country and eBay's marketplace: a sales channel is the unit Zalando prices,
 * stocks and reports orders against, so two of them cannot share a record.
 */
export const zalandoOverride: ProviderSettingsOverride = {
  provider: 'zalando',
  displayName: 'Zalando',
  // Deliberately not `price.push`: the price API is specified and understood,
  // but nothing in this system calls a connector to push a price — there is no
  // `updatePrice` on the contract and no sync event that would reach one.
  // Claiming the capability would light up a pricing tab that does nothing.
  //
  // `categories.read` / `attributes.read` cover outlines: zDirect's product
  // templates, which is what this provider has instead of a category tree.
  // Still no `products.read` — Zalando publishes no endpoint that lists a
  // merchant's articles at all (see `ZalandoConnector.getProducts`).
  capabilities: ['orders.read', 'stock.push', 'categories.read', 'attributes.read'],
  credentials: [
    { key: 'clientId', type: 'text', labelKey: cred('clientId'), helpKey: cred('clientIdHelp'), required: true },
    { key: 'clientSecret', type: 'password', labelKey: cred('clientSecret'), required: true, secret: true },
    {
      key: 'merchantId',
      type: 'text',
      labelKey: cred('merchantId'),
      helpKey: cred('merchantIdHelp'),
      required: true,
    },
    {
      key: 'salesChannelId',
      type: 'text',
      labelKey: cred('salesChannelId'),
      helpKey: cred('salesChannelIdHelp'),
      required: true,
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'ZL-' },
    // DOĞRULANAMADI: Zalando's published quota.
    'advanced.rateLimitPerMinute': { default: 60 },
  },
  docsUrl: 'https://developers.merchants.zalando.com/docs/auth.html',
};
