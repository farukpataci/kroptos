import { BadRequestException, Injectable } from '@nestjs/common';
import { CarrierConnector } from './CarrierConnector';
import { CarrierHttpClient } from './CarrierHttpClient';
import { CarrierRateLimiter } from './CarrierRateLimiter';
import { MockCarrierConnector } from '../mock/MockCarrierConnector';
import { HepsijetConnector } from '../hepsijet/HepsijetConnector';
import { YurticiConnector } from '../yurtici/YurticiConnector';
import { ArasConnector } from '../aras/ArasConnector';
import { DhlConnector } from '../dhl/DhlConnector';
import { MngConnector } from '../mng/MngConnector';
import { SendeoConnector } from '../sendeo/SendeoConnector';
import { PttConnector } from '../ptt/PttConnector';
import { DpdConnector } from '../dpd/DpdConnector';
import { SuratConnector } from '../surat/SuratConnector';
import { GlsConnector } from '../gls/GlsConnector';
import { UpsConnector } from '../ups/UpsConnector';
import { FedexConnector } from '../fedex/FedexConnector';
import { InpostConnector } from '../inpost/InpostConnector';
import { PostnlConnector } from '../postnl/PostnlConnector';
import { RoyalmailConnector } from '../royalmail/RoyalmailConnector';
import { EvriConnector } from '../evri/EvriConnector';

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
      case 'DHL':
        return new DhlConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'MNG':
        return new MngConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'SENDEO':
        return new SendeoConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'PTT':
        return new PttConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'DPD':
        return new DpdConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'SURAT':
        return new SuratConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'GLS':
        return new GlsConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'UPS':
        return new UpsConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'FEDEX':
        return new FedexConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'INPOST':
        return new InpostConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'POSTNL':
        return new PostnlConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'ROYAL_MAIL':
        return new RoyalmailConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      case 'EVRI':
        return new EvriConnector(credentials, this.httpClient, this.rateLimiter, isTestMode);
      default:
        // Every other CarrierProvider value is declared in CarrierTypes but has
        // no connector yet. Refusing beats falling back to the mock: a silent
        // fallback would hand out tracking numbers no carrier issued.
        throw new BadRequestException(`Taşıyıcı entegrasyonu henüz uygulanmadı: ${provider}`);
    }
  }

  /** Providers that can actually be selected today. */
  supportedProviders(): string[] {
    return ['MOCK', 'HEPSIJET', 'YURTICI', 'ARAS', 'DHL', 'MNG', 'SENDEO', 'PTT', 'DPD', 'SURAT', 'GLS', 'UPS', 'FEDEX', 'INPOST', 'POSTNL', 'ROYAL_MAIL', 'EVRI'];
  }
}
