import { BadRequestException, Injectable } from '@nestjs/common';
import { EcommerceConnector } from './EcommerceConnector';
import { EcommerceHttpClient } from './EcommerceHttpClient';
import { EcommerceRateLimiter } from './EcommerceRateLimiter';
import { ShopifyConnector } from '../shopify/ShopifyConnector';
import { IdeasoftConnector } from '../ideasoft/IdeasoftConnector';
import { TicimaxConnector } from '../ticimax/TicimaxConnector';
import { TsoftConnector } from '../tsoft/TsoftConnector';
import { OpencartConnector } from '../opencart/OpencartConnector';

@Injectable()
export class EcommerceConnectorFactory {
  constructor(
    private readonly httpClient: EcommerceHttpClient,
    private readonly rateLimiter: EcommerceRateLimiter,
  ) {}

  create(
    provider: string,
    credentials: Record<string, any>,
    settings: Record<string, unknown> = {},
  ): EcommerceConnector {
    switch (provider.toUpperCase()) {
      case 'SHOPIFY':
        return new ShopifyConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'IDEASOFT':
        return new IdeasoftConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'TICIMAX':
        return new TicimaxConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'TSOFT':
        return new TsoftConnector(credentials, this.httpClient, this.rateLimiter, settings);
      case 'OPENCART':
        return new OpencartConnector(credentials, this.httpClient, this.rateLimiter, settings);

      default:
        throw new BadRequestException(
          `Henüz desteklenmeyen e-ticaret altyapısı sağlayıcısı: ${provider}`,
        );
    }
  }
}
