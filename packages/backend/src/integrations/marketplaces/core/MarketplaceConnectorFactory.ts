import { Injectable, BadRequestException } from '@nestjs/common';
import { MarketplaceConnector } from './MarketplaceConnector';
import { MarketplaceHttpClient } from './MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './MarketplaceRateLimiter';
import { TrendyolConnector } from '../trendyol/TrendyolConnector';
import { TrendyolGlobalConnector } from '../trendyol_global/TrendyolGlobalConnector';
import { HepsiburadaConnector } from '../hepsiburada/HepsiburadaConnector';
import { AmazonConnector } from '../amazon/AmazonConnector';
import { N11Connector } from '../n11/N11Connector';
import { CicekSepetiConnector } from '../ciceksepeti/CicekSepetiConnector';
import { PazaramaConnector } from '../pazarama/PazaramaConnector';
import { EtsyConnector } from '../etsy/EtsyConnector';
import { PttAvmConnector } from '../pttavm/PttAvmConnector';
import { IdefixConnector } from '../idefix/IdefixConnector';
import { EbayConnector } from '../ebay/EbayConnector';
import { TemuConnector } from '../temu/TemuConnector';
import { ZalandoConnector } from '../zalando/ZalandoConnector';
import { AllegroConnector } from '../allegro/AllegroConnector';
import { AliExpressConnector } from '../aliexpress/AliExpressConnector';
import { WooCommerceConnector } from '../../ecommerce/woocommerce/WooCommerceConnector';
import { ShopifyConnector } from '../../ecommerce/shopify/ShopifyConnector';

@Injectable()
export class MarketplaceConnectorFactory {
  constructor(
    private readonly httpClient: MarketplaceHttpClient,
    private readonly rateLimiter: MarketplaceRateLimiter,
  ) {}

  /**
   * @param settings Resolved integration settings. Optional so credential-only
   *   callers (connection tests, category lookups) keep working before an
   *   integration has been configured.
   */
  create(
    provider: string,
    credentials: Record<string, any>,
    settings: Record<string, unknown> = {},
  ): MarketplaceConnector {
    const p = provider.toUpperCase();
    switch (p) {
      case 'TRENDYOL':
        return new TrendyolConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'TRENDYOL_GLOBAL':
        return new TrendyolGlobalConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'HEPSIBURADA':
        return new HepsiburadaConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'AMAZON':
        return new AmazonConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'N11':
        return new N11Connector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'CICEKSEPETI':
        return new CicekSepetiConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'PAZARAMA':
        return new PazaramaConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'ETSY':
        return new EtsyConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'PTTAVM':
        return new PttAvmConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'IDEFIX':
        return new IdefixConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'EBAY':
        return new EbayConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'TEMU':
        return new TemuConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'ZALANDO':
        return new ZalandoConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'ALLEGRO':
        return new AllegroConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'ALIEXPRESS':
        return new AliExpressConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'WOOCOMMERCE':
        return new WooCommerceConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'SHOPIFY':
        return new ShopifyConnector(credentials, this.httpClient, this.rateLimiter, settings);
      default:
        throw new BadRequestException(`Unsupported marketplace provider: ${provider}`);
    }
  }
}
