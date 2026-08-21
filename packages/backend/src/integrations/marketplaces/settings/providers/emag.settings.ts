import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.emag.${key}`;
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;
const option = (key: string, value: string) => `${I}.options.${key}.${value}`;
const opts = (key: string, values: string[]) =>
  values.map((value) => ({ value, labelKey: option(key, value) }));

/** The four markets one eMAG integration can point at. */
const EMAG_COUNTRIES = ['RO', 'BG', 'HU', 'PL'] as const;

/**
 * eMAG Marketplace (Romania, Bulgaria, Hungary, Poland).
 *
 * `country` sits in `credentials` rather than in a settings section, exactly as
 * on `trendyol_global`: settings are saved *after* the integration exists, but
 * the connector needs the market on its very first call — the connection test —
 * to pick a host, a currency and a throttling bucket. Collecting it with the
 * credentials also means `MarketplaceCredentialService.validate()` rejects a
 * market-less create (and an unsupported code) before anything is persisted.
 *
 * DOĞRULANAMADI: nothing here has been exercised against a real eMAG seller
 * account, and the connector was written against documentation v4.4.4. Three
 * decisions that v4.5.1 may change carry the `emag-v4.5.1` TODO marker in
 * `EmagConnector.ts`.
 */
export const emagOverride: ProviderSettingsOverride = {
  provider: 'emag',
  displayName: 'eMAG',
  // Exactly the operations EmagConnector issues a request for.
  //
  // Deliberately absent:
  //   - `products.push` / `price.push` — the connector never sends product
  //     documentation or prices; `product_offer/save` is used for stock only.
  //   - `orders.updateStatus` — `order/acknowledge` is out of scope this round
  //     (it becomes its own queue job in the sync-flow step).
  //   - `returns.read` / `shipment.label` — `rma` and `awb` are out of scope.
  capabilities: ['orders.read', 'products.read', 'stock.push', 'categories.read', 'attributes.read'],
  credentials: [
    {
      key: 'country',
      type: 'select',
      labelKey: label('emag.country'),
      helpKey: help('emag.country'),
      required: true,
      options: EMAG_COUNTRIES.map((code) => ({
        value: code,
        labelKey: option('emag.country', code),
      })),
    },
    {
      key: 'username',
      type: 'text',
      labelKey: cred('username'),
      helpKey: cred('usernameHelp'),
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
    {
      // Not a credential — a deployment precondition. eMAG rejects calls from an
      // IP the seller never registered with the same 401 as a wrong password, so
      // the seller who has not done this reads a correct password as broken.
      // Stated at the point where the password is entered, which is the only
      // moment they are looking.
      key: 'emag.ipWhitelistNotice',
      type: 'info',
      labelKey: cred('ipWhitelist'),
      helpKey: cred('ipWhitelistHelp'),
      colSpan: 2,
    },
  ],
  patchFields: {
    // eMAG's four markets, widened here rather than in `base.settings.ts`.
    // Base carries only what every provider shares; a market parked there
    // makes eMAG's missing translations fail all fifteen providers at once.
    // Appended, never reordered — saved settings rows hold these verbatim.
    'general.currency': {
      options: opts('general.currency', ['TRY', 'USD', 'EUR', 'GBP', 'RON', 'BGN', 'HUF', 'PLN']),
    },
    'general.timezone': {
      options: opts('general.timezone', [
        'Europe/Istanbul',
        'Europe/London',
        'Europe/Berlin',
        'UTC',
        'Europe/Bucharest',
        'Europe/Sofia',
        'Europe/Budapest',
        'Europe/Warsaw',
      ]),
    },
    // Empty by design, NOT 'EMG-'. A single-market install has nothing to
    // disambiguate and should not carry a prefix it never asked for; an operator
    // running two eMAG markets sets 'EMG-RO-' / 'EMG-PL-' themselves. eMAG is the
    // first provider whose connector actually reads this field.
    'orders.numberPrefix': { default: '' },
    // eMAG documents 20 requests/minute per resource.
    'advanced.rateLimitPerMinute': { default: 20 },
  },
  docsUrl: 'https://marketplace.emag.ro/api-3',
};
