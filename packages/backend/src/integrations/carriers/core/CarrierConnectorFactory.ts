import { BadRequestException, Injectable } from '@nestjs/common';
import { CarrierConnector } from './CarrierConnector';
import { CarrierHttpClient } from './CarrierHttpClient';
import { CarrierRateLimiter } from './CarrierRateLimiter';
import { MockCarrierConnector } from '../mock/MockCarrierConnector';
import { HepsijetConnector } from '../hepsijet/HepsijetConnector';
import { YurticiConnector } from '../yurtici/YurticiConnector';
import { ArasConnector } from '../aras/ArasConnector';

@Injectable()
export class CarrierConnectorFactory {
  constructor(
    private readonly httpClient: CarrierHttpClient,
    private readonly rateLimiter: CarrierRateLimiter,
  ) {}

  create(
    provider: string,
    credentials: Record<string, any>,
    isTestMode = true,
  ): CarrierConnector {
    switch (provider.toUpperCase()) {
      case 'MOCK':
        return new MockCarrierConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'HEPSIJET':
        return new HepsijetConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'YURTICI':
        return new YurticiConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'ARAS':
        return new ArasConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      default:
        // Every other CarrierProvider value is declared in CarrierTypes but has
        // no connector yet. Refusing beats falling back to the mock: a silent
        // fallback would hand out tracking numbers no carrier issued.
        throw new BadRequestException(`Taşıyıcı entegrasyonu henüz uygulanmadı: ${provider}`);
    }
  }

  /** Providers that can actually be selected today. */
  supportedProviders(): string[] {
    return ['MOCK', 'HEPSIJET', 'YURTICI', 'ARAS'];
  }
}
