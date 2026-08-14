import { Injectable, BadRequestException } from '@nestjs/common';
import { ErpConnector } from './ErpConnector';
import { LogoConnector } from '../logo/LogoConnector';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

@Injectable()
export class ErpConnectorFactory {
  constructor(
    private readonly httpClient: MarketplaceHttpClient,
    private readonly rateLimiter: MarketplaceRateLimiter,
  ) {}

  create(provider: string, credentials: Record<string, any>): ErpConnector {
    const p = provider.toUpperCase();
    switch (p) {
      case 'LOGO':
      case 'LOGO_ERP':
        return new LogoConnector(credentials, this.httpClient, this.rateLimiter);
      default:
        throw new BadRequestException(`Unsupported ERP provider: ${provider}`);
    }
  }
}
