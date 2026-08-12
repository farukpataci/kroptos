import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.aliexpress.${key}`;

/**
 * AliExpress Open Platform.
 *
 * NOT REGISTERED YET — deliberately absent from `OVERRIDES`, which keeps the
 * catalogue card on "coming soon". The transport is built and tested, but the
 * signature variant and every listing method name are unconfirmed, so a
 * connection here could authenticate at best and sync nothing.
 *
 * Enabling it is one line here plus filling in METHODS in AliExpressConnector
 * and confirming ACTIVE_VARIANT in AliExpressSignature.
 * See docs/plans/aliexpress-integration.md.
 */
export const aliexpressOverride: ProviderSettingsOverride = {
  provider: 'aliexpress',
  displayName: 'AliExpress',
  capabilities: ['orders.read'],
  credentials: [
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
    'orders.numberPrefix': { default: 'AE-' },
    // DOĞRULANAMADI: AliExpress's published quota.
    'advanced.rateLimitPerMinute': { default: 60 },
  },
  docsUrl: 'https://openservice.aliexpress.com/doc/doc.htm',
};
