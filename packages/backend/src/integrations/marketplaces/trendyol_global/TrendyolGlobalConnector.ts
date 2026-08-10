import { isTrendyolGlobalCountry, trendyolGlobalCountryName } from '@kroptos/shared';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { TrendyolBaseConnector } from '../trendyol/TrendyolBaseConnector';

/**
 * One of Trendyol's international storefronts, fixed at construction by the
 * `country` credential. The country is never a method parameter: every call
 * this connector makes belongs to exactly one storefront, and threading it
 * through the signatures would invite a call that forgets it.
 *
 * DOĞRULANAMADI: the supported country list is a subset assembled from
 * documentation excerpts (see TRENDYOL_GLOBAL_COUNTRIES), and no call has been
 * exercised against a real international seller account.
 */
export class TrendyolGlobalConnector extends TrendyolBaseConnector {
  private readonly country: string;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('TRENDYOL_GLOBAL', credentials, httpClient, rateLimiter, settings);

    const raw = String(credentials?.country ?? '').trim().toUpperCase();
    if (!raw) {
      throw new Error(
        'Trendyol Global entegrasyonu için ülke seçilmedi. Entegrasyon ayarlarından ülkeyi seçin.',
      );
    }
    // An unsupported code must fail here rather than reaching the gateway: a
    // wrong storefront either 404s or, worse, answers with another country's
    // catalogue.
    if (!isTrendyolGlobalCountry(raw)) {
      throw new Error(
        `Trendyol Global için desteklenmeyen ülke kodu: '${raw}'. ` +
          'Desteklenen ülkeler entegrasyon ayarlarındaki listede yer alır.',
      );
    }

    this.country = raw;
  }

  protected get displayName(): string {
    return 'Trendyol Global';
  }

  protected get storefrontCode(): string {
    return this.country;
  }

  protected get storefrontLabel(): string {
    return trendyolGlobalCountryName(this.country);
  }

  /**
   * Each storefront gets its own throttling bucket. Sharing one bucket across
   * countries would let a busy storefront stall a quiet one, and the base class
   * keys by provider name alone.
   */
  protected get rateLimitKey(): string {
    return `TRENDYOL_GLOBAL:${this.country}`;
  }

  /**
   * DOĞRULANAMADI: which currency each storefront settles in. Trendyol sends a
   * currency on the order payload and that value is preferred; this fallback
   * only applies when the response omits it entirely. Guessing a per-country
   * table here would silently mislabel money, so the neutral choice is to keep
   * whatever the marketplace said and leave this empty.
   *
   * TODO: replace with the documented per-storefront currency once the
   * international API reference is accessible.
   */
  protected get fallbackCurrency(): string {
    return '';
  }

  protected get defaultAddressCountry(): string {
    return this.country;
  }

  protected get orderSource(): string {
    return 'trendyol_global';
  }
}
