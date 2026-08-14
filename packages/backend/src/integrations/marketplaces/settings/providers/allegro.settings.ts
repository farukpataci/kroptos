import type { ProviderSettingsOverride } from '@kroptos/shared';

const I = 'integrations.settings';
const cred = (key: string) => `${I}.credentials.allegro.${key}`;

/**
 * Allegro (Poland).
 *
 * Registered, unlike temu and zalando: the hosts, the token endpoint, the
 * versioned media type and the order and offer paths are all confirmed from
 * Allegro's developer portal, so a connection here can actually complete.
 *
 * There is no merchant/seller id field — Allegro derives the seller from the
 * user token. The refresh token is pasted because seller data requires a token
 * from the authorization-code or device flow, which this connector does not
 * perform itself.
 */
export const allegroOverride: ProviderSettingsOverride = {
  provider: 'allegro',
  displayName: 'Allegro',
  capabilities: [
    'orders.read',
    'products.read',
    'stock.push',
    'categories.read',
    'attributes.read',
  ],
  credentials: [
    { key: 'clientId', type: 'text', labelKey: cred('clientId'), helpKey: cred('clientIdHelp'), required: true },
    { key: 'clientSecret', type: 'password', labelKey: cred('clientSecret'), required: true, secret: true },
    {
      key: 'refreshToken',
      type: 'password',
      labelKey: cred('refreshToken'),
      helpKey: cred('refreshTokenHelp'),
      required: true,
      secret: true,
    },
  ],
  patchFields: {
    'orders.numberPrefix': { default: 'AL-' },
    // DOĞRULANAMADI: Allegro's published quota.
    'advanced.rateLimitPerMinute': { default: 60 },
  },
  docsUrl: 'https://developer.allegro.pl/documentation',
};
