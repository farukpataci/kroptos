import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { AccountingConnector } from '../core/AccountingConnector';
import {
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
} from '../core/AccountingTypes';
import { ExactBudgetManager } from './exact.budget';
import { EXACT_CAPABILITIES } from './exact.capabilities';
import { IExactClient } from './exact.client';
import { EXACT_DESCRIPTOR } from './exact.descriptor';
import { ExactInvoiceFlow } from './exact.invoice-flow';
import { ExactMockClient } from './exact.mock-client';
import { ExactProductionClient } from './exact.production-client';
import { ExactRequestMapper } from './exact.request-mapper';
import { ExactResponseMapper } from './exact.response-mapper';
import { ExactStatusMapper } from './exact.status-mapper';
import { ExactTestClient } from './exact.test-client';
import { ExactCountry } from './exact.types';

export class ExactOnlineConnector extends AccountingConnector {
  readonly provider = 'EXACT-ONLINE';
  readonly capabilities = EXACT_CAPABILITIES;
  readonly descriptor = EXACT_DESCRIPTOR;
  readonly environment: AccountingEnvironment;

  private client: IExactClient;
  private readonly country: ExactCountry;
  private readonly division: number | string;
  private readonly clientId?: string;
  private readonly budgetManager: ExactBudgetManager;
  private readonly invoiceFlow: ExactInvoiceFlow;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    customClient?: IExactClient,
  ) {
    super();
    this.environment = environment;
    this.country = (credentials?.country as ExactCountry) || 'NL';
    this.division = credentials?.division || credentials?.companyId || 100001;
    this.clientId = credentials?.clientId?.trim() || undefined;

    this.budgetManager = ExactBudgetManager.getInstance();
    this.invoiceFlow = new ExactInvoiceFlow(this.budgetManager);

    if (customClient) {
      this.client = customClient;
    } else if (this.environment === 'MOCK') {
      this.client = new ExactMockClient(this.budgetManager);
    } else if (this.environment === 'TEST') {
      this.client = new ExactTestClient();
    } else {
      this.client = new ExactProductionClient();
    }
  }

  /**
   * Exact Online bağlantı ve yetki doğrulama testi (§5.2, §5.5).
   */
  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('EXACT-ONLINE', this.environment);
    }

    try {
      const me = await this.client.getMe();
      const divCode = this.division || me.CurrentDivision;

      return {
        success: true,
        message: `Exact Online (${this.country}) bağlantısı başarılı. Kullanıcı: ${me.FullName} (${me.Email}), Aktif Bölüm: ${divCode}`,
        companyId: String(divCode),
        companyName: me.DivisionCustomer || `Bölüm ${divCode}`,
        environment: this.environment,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Exact Online bağlantı testi başarısız: ${err?.message || 'Bilinmeyen hata'}`,
        environment: this.environment,
      };
    }
  }

  /**
   * Satış faturası oluşturma akışı (Bütçe denetimli + seri çalıştırma + mutabakatlı).
   */
  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('EXACT-ONLINE', this.environment);
    }

    // 1. Müşteri (Cari) ID Belirleme veya Oluşturma
    let customerId = request.contact?.id;
    if (!customerId) {
      const contactReq: AccountingContactRequest = {
        companyId: request.companyId,
        kroptosKey: request.contact?.email || request.contact?.name || 'cust',
        name: request.contact?.name || 'Müşteri',
        email: request.contact?.email,
        phone: request.contact?.phone,
        address: request.contact?.address,
        city: request.contact?.city,
        taxNumber: request.contact?.taxNumber,
      };
      const contactResult = await this.syncContact(contactReq);
      customerId = contactResult.externalId;
    }

    // 2. Güvenli fatura yaşam döngüsünü çalıştır
    return this.invoiceFlow.executeCreateInvoice(
      this.client,
      this.division,
      request,
      customerId,
    );
  }

  /**
   * Cari hesap senkronizasyonu.
   */
  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('EXACT-ONLINE', this.environment);
    }

    const payload = ExactRequestMapper.toAccount({
      name: request.name,
      email: request.email,
      phone: request.phone,
      address: request.address,
      city: request.city,
      taxNumber: request.taxNumber,
    });
    const createdAccount = await this.client.createAccount(this.division, payload);

    return {
      externalId: createdAccount.ID,
      rawResponse: createdAccount,
    };
  }

  /**
   * Ürün -> Exact Online eşlemesi
   */
  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    return {
      externalId: request.sku,
      code: request.sku,
      rawResponse: {
        sku: request.sku,
        name: request.name,
        division: this.division,
      },
    };
  }

  /**
   * Tahsilat kaydetme (MOCK_ONLY / REST sınırları çerçevesinde).
   */
  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('EXACT-ONLINE', this.environment);
    }

    return {
      externalId: `exact-pay-${Date.now()}`,
      rawResponse: {
        status: 'recorded',
        amount: request.amount,
        currency: request.currency,
        invoiceId: request.invoiceExternalId,
        paymentDate: request.paymentDate,
        division: this.division,
      },
    };
  }

  /**
   * Fatura iptal akışı (§5.8 & Conformance Kural 18).
   * Kural: İptal yolu seçilmeden önce belgenin güncel durumu kesinlikle okunmalıdır.
   */
  async cancelInvoice(externalId: string): Promise<{ success: boolean; rawResponse?: any }> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('EXACT-ONLINE', this.environment);
    }

    // 1. Belgenin güncel durumunu oku (Kural 18)
    const currentInvoice = await this.client.getSalesInvoice(this.division, externalId);

    // 2. İptal edilebilirlik denetimi (İşlenmiş fatura silinemez)
    const cancelCheck = ExactStatusMapper.canCancelDirectly(currentInvoice);
    if (!cancelCheck.canCancel) {
      throw new Error(cancelCheck.reason);
    }

    // 3. İptal / Silme işlemini gerçekleştir
    const cancelled = await this.client.cancelSalesInvoice(this.division, externalId);

    return {
      success: true,
      rawResponse: cancelled,
    };
  }

  /**
   * Müşteri sipariş / PO referans koduyla fatura sorgulama (§5.8).
   */
  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('EXACT-ONLINE', this.environment);
    }

    const found = await this.client.findSalesInvoiceByReference(this.division, referenceCode);
    if (!found) {
      return null;
    }

    return ExactResponseMapper.toInvoiceResult(found);
  }

  /**
   * Maskelenmiş kimlik bilgileri
   */
  getMaskedCredentials(): Record<string, string> {
    return {
      country: this.country,
      division: String(this.division),
      clientId: this.clientId
        ? `${this.clientId.substring(0, 4)}••••`
        : 'Merkezi KroptOS Uygulaması',
    };
  }
}
