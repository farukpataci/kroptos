import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.zalando.${key}`;

/**
 * Zalando zDirect partner platform.
 *
 * NOT REGISTERED YET — deliberately absent from `OVERRIDES`, which keeps the
 * catalogue card on "coming soon". Authentication is fully verified against
 * Zalando's published spec, so a connection test would genuinely work today;
 * what is missing is the business side (orders path unconfirmed, stock and
 * price paths unknown). Registering it now would offer a connection that
 * authenticates and then syncs nothing.
 *
 * Enabling it is one line here plus filling in UNCONFIRMED_PATHS in
 * ZalandoConnector. See docs/plans/zalando-integration.md.
 *
 * `merchantId` is a credential rather than a settings field because it is a
 * path parameter on the business endpoints — the connector needs it as soon as
 * it makes its first business call.
 */
export const zalandoOverride: ProviderSettingsOverride = {
  provider: 'zalando',
  displayName: 'Zalando',
  capabilities: ['orders.read'],
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
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'ZL-' },
    // DOĞRULANAMADI: Zalando's published quota.
    'advanced.rateLimitPerMinute': { default: 60 },
  },
  docsUrl: 'https://developers.merchants.zalando.com/docs/auth.html',
};
