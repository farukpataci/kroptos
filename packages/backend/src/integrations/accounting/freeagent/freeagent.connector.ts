import { BadRequestException } from '@nestjs/common';
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
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { IFreeAgentClient } from './freeagent.client';
import { FreeAgentMockClient } from './freeagent.mock-client';
import { FreeAgentTestClient } from './freeagent.test-client';
import { FreeAgentProductionClient } from './freeagent.production-client';
import { FREEAGENT_CAPABILITIES } from './freeagent.capabilities';
import { FREEAGENT_DESCRIPTOR } from './freeagent.descriptor';
import { FreeAgentInvoiceFlow } from './freeagent.invoice-flow';
import { FreeAgentStatusMapper } from './freeagent.status-mapper';
import { FreeAgentUriHelper } from './freeagent.uri';

export class FreeAgentConnector extends AccountingConnector {
  readonly provider = 'FREEAGENT';
  readonly capabilities = FREEAGENT_CAPABILITIES;
  readonly descriptor = FREEAGENT_DESCRIPTOR;
  readonly environment: AccountingEnvironment;

  private client: IFreeAgentClient;
  private readonly defaultCategoryUrl?: string;
  private readonly bankAccountUrl?: string;
  private readonly clientId?: string;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    customClient?: IFreeAgentClient,
  ) {
    super();
    this.environment = environment;
    this.defaultCategoryUrl = credentials?.defaultCategoryUrl?.trim() || undefined;
    this.bankAccountUrl = credentials?.bankAccountUrl?.trim() || undefined;
    this.clientId = credentials?.clientId?.trim() || undefined;

    if (customClient) {
      this.client = customClient;
    } else if (this.environment === 'MOCK') {
      this.client = new FreeAgentMockClient();
    } else if (this.environment === 'TEST') {
      this.client = new FreeAgentTestClient();
    } else {
      this.client = new FreeAgentProductionClient();
    }
  }

  /**
   * Bağlantı ve Şirket profilini doğrular.
   * Mock dışındaki ortamlarda henüz canlı ağ izni verilmediğinden guard devreye girer.
   */
  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('freeagent', this.environment);
    }

    try {
      const company = await this.client.getCompany();
      const user = await this.client.getCurrentUser();

      return {
        success: true,
        message: `FreeAgent bağlantısı başarılı. Şirket: ${company.name} (${company.currency}), Kullanıcı: ${user.first_name} ${user.last_name}`,
        companyId: company.subdomain || FreeAgentUriHelper.extractResourceId(company.url, 'company'),
        companyName: company.name,
        environment: this.environment,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `FreeAgent bağlantı testi başarısız: ${err?.message || 'Bilinmeyen hata'}`,
        environment: this.environment,
      };
    }
  }

  /**
   * §5.2 & §5.3 Fatura Oluşturma:
   * Taslak Fatura -> Sunucu Mutabakatı -> mark_as_sent
   */
  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    // Varsayılan kategori veya talep içi kategori yoksa hata fırlatılır
    const fallbackCategory =
      this.defaultCategoryUrl ||
      (this.environment === 'MOCK'
        ? 'https://api.sandbox.freeagent.com/v2/categories/001'
        : undefined);

    return FreeAgentInvoiceFlow.executeCreateInvoice(this.client, request, {
      environment: this.environment as any,
      defaultCategoryUrl: fallbackCategory,
    });
  }

  /**
   * Tahsilat / Ödeme Kaydı:
   * Bank Transaction Explanations API'si üzerinden faturayı ödenmiş yapar.
   */
  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    const invoiceExternalId = request.invoiceExternalId;
    if (!invoiceExternalId) {
      throw new BadRequestException('[FreeAgent Payment] invoiceExternalId zorunludur.');
    }

    const bankAccountId = request.accountId || '1';
    const bankAccountUri =
      this.bankAccountUrl ||
      FreeAgentUriHelper.buildResourceUri('bank_accounts', bankAccountId, this.environment as any);

    const invoiceUri = FreeAgentUriHelper.buildResourceUri(
      'invoices',
      invoiceExternalId,
      this.environment as any,
    );

    const datedOn = request.paymentDate
      ? new Date(request.paymentDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const explanation = await this.client.createBankTransactionExplanation({
      bank_account: bankAccountUri,
      paid_invoice: invoiceUri,
      dated_on: datedOn,
      gross_value: request.amount,
      description: request.notes || `KroptOS Fatura Tahsilatı: ${request.referenceCode}`,
    });

    const updatedInvoice = await this.client.getInvoice(invoiceExternalId);
    const documentStatus = FreeAgentStatusMapper.toKroptosStatus(updatedInvoice.status);

    return {
      externalId: String(explanation.id || `EXP-${Date.now()}`),
      rawResponse: {
        success: true,
        status: updatedInvoice.status === 'Paid' ? 'completed' : 'pending',
        amount: request.amount,
        currency: request.currency || updatedInvoice.currency || 'GBP',
        paidAt: datedOn,
        documentStatus,
        explanationUrl: explanation.url,
        invoiceStatus: updatedInvoice.status,
        paidValue: updatedInvoice.paid_value,
        dueValue: updatedInvoice.due_value,
      },
    };
  }

  /**
   * §5.8 Fatura İptali:
   * 1. Güncel durumu oku
   * 2. İptal edilebilirliği kontrol et (Paid/Overpaid için credit note gerekir)
   * 3. mark_as_cancelled geçişini çağır
   * 4. Yeni durumu geri oku ve döndür
   */
  async cancelInvoice(invoiceId: string): Promise<{ success: boolean; rawResponse?: any }> {
    if (!invoiceId) {
      throw new BadRequestException('[FreeAgent Cancel] invoiceId zorunludur.');
    }

    const invoice = await this.client.getInvoice(invoiceId);

    // İptal edilebilirliği doğrula
    const check = FreeAgentStatusMapper.isTransitionAllowed(invoice.status);
    if (!check.allowed) {
      throw new BadRequestException(check.reason);
    }

    const cancelledInvoice = await this.client.transitionInvoice(invoiceId, 'mark_as_cancelled');
    const documentStatus = FreeAgentStatusMapper.toKroptosStatus(cancelledInvoice.status);

    return {
      success: true,
      rawResponse: {
        status: 'cancelled',
        documentStatus,
        previousStatus: invoice.status,
        currentStatus: cancelledInvoice.status,
        url: cancelledInvoice.url,
      },
    };
  }

  /**
   * §5.9 Harici referans ile fatura arama:
   * FreeAgent listeleme API'si po_reference filtresi desteklemediğinden DOCUMENTATION_REQUIRED.
   */
  async findInvoiceByReference(_referenceCode: string): Promise<AccountingInvoiceResult | null> {
    return null;
  }

  /**
   * Cari senkronizasyonu
   */
  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    const created = await this.client.createContact({
      name: request.name,
      email: request.email,
      phone_number: request.phone,
      address1: request.address,
      town: request.city,
      country: 'United Kingdom',
    });

    const externalId = created.url
      ? FreeAgentUriHelper.extractResourceId(created.url, 'contacts')
      : String(created.id || '');

    return {
      externalId,
      rawResponse: created as any,
    };
  }

  /**
   * Ürün -> Gelir kategorisi eşlemesi
   */
  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    return {
      externalId: request.sku,
      code: request.sku,
      rawResponse: {
        sku: request.sku,
        name: request.name,
      },
    };
  }

  /**
   * Maskelenmiş kimlik bilgileri
   */
  getMaskedCredentials(): Record<string, string> {
    return {
      defaultCategoryUrl: this.defaultCategoryUrl || 'Tanımlı değil',
      bankAccountUrl: this.bankAccountUrl || 'Tanımlı değil',
      clientId: this.clientId
        ? `${this.clientId.substring(0, 4)}••••`
        : 'Merkezi KroptOS Uygulaması',
    };
  }
}
