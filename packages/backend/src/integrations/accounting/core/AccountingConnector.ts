import {
  AccountingCapabilities,
  AccountingContactRequest,
  AccountingContactResult,
  AccountingEnvironment,
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
  AccountingPaymentRequest,
  AccountingPaymentResult,
  AccountingProductRequest,
  AccountingProductResult,
  AccountingTestConnectionResult,
  CapabilityStatus,
} from './AccountingTypes';
import { assertCapability } from './AccountingCapabilities';

export abstract class AccountingConnector {
  abstract readonly provider: string;
  abstract readonly capabilities: AccountingCapabilities;
  abstract readonly environment: AccountingEnvironment;

  abstract testConnection(): Promise<AccountingTestConnectionResult>;
  abstract createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult>;
  abstract recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult>;
  abstract syncContact(request: AccountingContactRequest): Promise<AccountingContactResult>;
  abstract mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult>;

  // Optional methods
  abstract findInvoiceByReference?(referenceCode: string): Promise<AccountingInvoiceResult | null>;
  buildAuthorizationUrl?(params: { state: string; redirectUri: string }): string;
  exchangeAuthorizationCode?(params: { code: string; redirectUri: string }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>;

  /** K3 — yetenek kapısı: SUPPORTED (MOCK'ta MOCK_ONLY) değilse fırlatır, sahte başarı yok. */
  protected guard(capability: keyof AccountingCapabilities & string): void {
    assertCapability(this.provider, capability, this.capabilities[capability] as CapabilityStatus | undefined, this.environment);
  }

  /** K3 — mock cevap gerçek gibi gösterilmez. */
  protected mockConnectionResult(startedAt: number, companyId?: string): AccountingTestConnectionResult {
    return {
      success: true,
      isMock: true,
      message: `MOCK — gerçek bağlantı doğrulanmadı (${this.provider})`,
      companyId,
      environment: 'MOCK',
      durationMs: Date.now() - startedAt,
    };
  }
}
