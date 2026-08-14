import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { TrendyolBaseConnector } from './TrendyolBaseConnector';

/**
 * Türkiye only. International storefronts are the `trendyol_global` provider,
 * with one integration record per country — see TrendyolBaseConnector for why
 * the protocol is shared but the integration is not.
 *
 * Türkiye's storefront code is documented as "1". Set to `undefined` to go back
 * to sending no storefront header at all, which is what this connector did
 * before the header fix.
 *
 * DOĞRULANAMADI: not exercised against a real seller account.
 */
const TR_STOREFRONT_CODE: string | undefined = '1';

export class TrendyolConnector extends TrendyolBaseConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('TRENDYOL', credentials, httpClient, rateLimiter, settings);
  }

  protected get displayName(): string {
    return 'Trendyol';
  }

  protected get storefrontCode(): string | undefined {
    return TR_STOREFRONT_CODE;
  }

  protected get storefrontLabel(): string {
    return 'Türkiye';
  }

  protected get fallbackCurrency(): string {
    return 'TRY';
  }

  protected get defaultAddressCountry(): string {
    return 'TR';
  }

  protected get orderSource(): string {
    return 'trendyol';
  }
}
