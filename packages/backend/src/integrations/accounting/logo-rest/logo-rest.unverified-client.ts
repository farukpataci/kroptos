import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { AccountingEnvironment } from '../core/AccountingTypes';
import { ILogoRestClient } from './logo-rest.client';

/**
 * TEST ve PRODUCTION için tek sınıf: Logo veri uçları doğrulanana ve Çözüm Ortağı
 * ClientId/Secret elde edilene kadar hiçbir gerçek ağ isteği yapılmaz (§12).
 */
export class LogoRestUnverifiedClient implements ILogoRestClient {
  constructor(
    private readonly environment: AccountingEnvironment,
    private readonly provider: string = 'LOGO-REST',
  ) {}

  private fail(): never {
    throw new IntegrationNotVerifiedError(this.provider, this.environment);
  }

  async testConnection(): Promise<never> { return this.fail(); }
  async createInvoice(): Promise<never> { return this.fail(); }
  async recordPayment(): Promise<never> { return this.fail(); }
  async syncContact(): Promise<never> { return this.fail(); }
  async mapProduct(): Promise<never> { return this.fail(); }
  async findInvoiceByReference(): Promise<never> { return this.fail(); }
}
