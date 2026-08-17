import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.temu.${key}`;

/**
 * Temu Open Platform.
 *
 * REGISTERED 2026-08-14, and registered *because* it is unverified rather than
 * despite it. It had been held out of `OVERRIDES` until a live call proved the
 * response shapes — but with the card disabled there was nowhere to enter
 * credentials, so that call could never happen. The gate was blocking the only
 * thing that could open it. Registering breaks the loop; it is not a claim that
 * the Tier 2 items below are settled.
 *
 * Still unverified — nobody has read a real response body, so the field names in
 * TemuTypes, the minor-unit assumption on amounts and the numeric order statuses
 * are all inferred. The connector is built to fail loudly rather than quietly on
 * each: an unrecognised list shape throws and names the keys it did receive.
 * Verification order is in docs/plans/temu-integration.md.
 *
 * `apiUrl` is a credential rather than a settings field for the same reason the
 * eBay marketplace is: settings are saved after the integration exists, but the
 * connector needs the host on its very first call.
 */
export const temuOverride: ProviderSettingsOverride = {
  provider: 'temu',
  displayName: 'Temu',
  // Exactly the three operations TemuConnector actually issues a request for.
  //
  // Deliberately absent, and each for its own reason rather than out of caution:
  //   - `stock.push` — updateStock refuses. The list element field names and the
  //     SKU→goods_id lookup are unknown, and a list Temu mis-parses can zero the
  //     stock of a whole catalogue.
  //   - `attributes.read` — getCategoryAttributes refuses, no verified method.
  //   - `price.push` — no price operation is written at all.
  //
  // Capabilities gate settings fields, so listing one here is what shows a
  // seller the controls for it. A badge over an operation that refuses is how
  // someone ends up trusting a sync that cannot run.
  capabilities: ['orders.read', 'products.read', 'categories.read'],
  credentials: [
    {
      key: 'apiUrl',
      type: 'text',
      labelKey: cred('apiUrl'),
      helpKey: cred('apiUrlHelp'),
      required: true,
    },
    { key: 'appKey', type: 'text', labelKey: cred('appKey'), helpKey: cred('appKeyHelp'), required: true },
    { key: 'appSecret', type: 'password', labelKey: cred('appSecret'), required: true, secret: true },
    {
      key: 'accessToken',
      type: 'password',
      labelKey: cred('accessToken'),
      helpKey: cred('accessTokenHelp'),
      required: true,
      secret: true,
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'TM-' },
    // DOĞRULANAMADI: Temu's published quota. Conservative until measured.
    'advanced.rateLimitPerMinute': { default: 60 },
  },
  docsUrl: 'https://partner.temu.com/documentation',
};
