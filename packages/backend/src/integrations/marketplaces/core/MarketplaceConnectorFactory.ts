import { Injectable, BadRequestException } from '@nestjs/common';
import { MarketplaceConnector } from './MarketplaceConnector';
import { MarketplaceHttpClient } from './MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './MarketplaceRateLimiter';
import { TrendyolConnector } from '../trendyol/TrendyolConnector';
import { HepsiburadaConnector } from '../hepsiburada/HepsiburadaConnector';
import { AmazonConnector } from '../amazon/AmazonConnector';
import { N11Connector } from '../n11/N11Connector';
import { CicekSepetiConnector } from '../ciceksepeti/CicekSepetiConnector';

@Injectable()
export class MarketplaceConnectorFactory {
  constructor(
    private readonly httpClient: MarketplaceHttpClient,
    private readonly rateLimiter: MarketplaceRateLimiter,
  ) {}

  create(provider: string, credentials: Record<string, any>): MarketplaceConnector {
    const p = provider.toUpperCase();
    switch (p) {
      case 'TRENDYOL':
        return new TrendyolConnector(credentials, this.httpClient, this.rateLimiter);
      case 'HEPSIBURADA':
        return new HepsiburadaConnector(credentials, this.httpClient, this.rateLimiter);
      case 'AMAZON':
        return new AmazonConnector(credentials, this.httpClient, this.rateLimiter);
      case 'N11':
        return new N11Connector(credentials, this.httpClient, this.rateLimiter);
      case 'CICEKSEPETI':
        return new CicekSepetiConnector(credentials, this.httpClient, this.rateLimiter);
      default:
        throw new BadRequestException(`Unsupported marketplace provider: ${provider}`);
    }
  }
}
