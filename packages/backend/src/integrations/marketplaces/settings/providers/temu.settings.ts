import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.temu.${key}`;

/**
 * Temu Open Platform.
 *
 * NOT REGISTERED YET. This override is deliberately absent from `OVERRIDES` in
 * manifest.registry.ts, which is what keeps the catalogue card showing "coming
 * soon" and its button disabled. Registering it is the single line that turns
 * Temu on — and it should only be added once the two unverified pieces are
 * settled:
 *
 *   1. the gateway host (collected here as `apiUrl`, so this one is ready), and
 *   2. the RPC method names for products, stock and categories, which live in
 *      METHODS inside TemuConnector and are currently null.
 *
 * Registering it earlier would offer sellers a connection that cannot complete.
 *
 * `apiUrl` is a credential rather than a settings field for the same reason the
 * eBay marketplace is: settings are saved after the integration exists, but the
 * connector needs the host on its very first call.
 */
export const temuOverride: ProviderSettingsOverride = {
  provider: 'temu',
  displayName: 'Temu',
  // Empty on purpose: no operation name is confirmed, so the connector supports
  // nothing yet. Claiming `orders.read` here would also un-hide settings fields
  // gated on that capability, describing behaviour that does not exist.
  capabilities: [],
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
