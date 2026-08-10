import { Injectable, BadRequestException } from '@nestjs/common';
import { MarketplaceConnector } from './MarketplaceConnector';
import { MarketplaceHttpClient } from './MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './MarketplaceRateLimiter';
import { TrendyolConnector } from '../trendyol/TrendyolConnector';
import { HepsiburadaConnector } from '../hepsiburada/HepsiburadaConnector';
import { AmazonConnector } from '../amazon/AmazonConnector';
import { N11Connector } from '../n11/N11Connector';
import { CicekSepetiConnector } from '../ciceksepeti/CicekSepetiConnector';
import { PazaramaConnector } from '../pazarama/PazaramaConnector';
import { EtsyConnector } from '../etsy/EtsyConnector';

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
      default:
        throw new BadRequestException(`Unsupported marketplace provider: ${provider}`);
    }
  }
}
