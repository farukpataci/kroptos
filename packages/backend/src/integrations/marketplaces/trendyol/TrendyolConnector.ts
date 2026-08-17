import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { TrendyolBaseConnector } from './TrendyolBaseConnector';

/**
 * Türkiye only. International storefronts are the `trendyol_global` provider,
 * with one integration record per country — see TrendyolBaseConnector for why
 * the protocol is shared but the integration is not.
 *
 * The gateway wants an ISO country code here, not the numeric storefront id.
 * "1" was accepted by the products endpoint and rejected with
 * `ValidationException: invalid storefrontCode` (400) by orders and
 * product-categories — so the connection test passed while order import and the
 * category tree were both dead. Set to `undefined` to send no header at all,
 * which the gateway also accepts.
 *
 * DOĞRULANDI 2026-08-17: 'TR' → 200 on orders, product-categories and products
 * against the stored seller account; '1' and '0' → 400 on orders/categories.
 */
const TR_STOREFRONT_CODE: string | undefined = 'TR';

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
