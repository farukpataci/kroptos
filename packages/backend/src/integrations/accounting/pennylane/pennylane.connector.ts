import { BadRequestException } from '@nestjs/common';
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
import { PENNYLANE_CAPABILITIES } from './pennylane.capabilities';
import { PENNYLANE_DESCRIPTOR } from './pennylane.descriptor';
import { IPennylaneClient } from './pennylane.client';
import { PennylaneMockClient } from './pennylane.mock-client';
import { PennylaneTestClient } from './pennylane.test-client';
import { PennylaneProductionClient } from './pennylane.production-client';
import { PennylaneInvoiceFlow } from './pennylane.invoice-flow';
import { PennylaneRequestMapper } from './pennylane.request-mapper';
import { PennylaneResponseMapper } from './pennylane.response-mapper';
import { PennylaneStatusMapper } from './pennylane.status-mapper';

export class PennylaneConnector extends AccountingConnector {
  readonly provider = 'PENNYLANE';
  readonly capabilities = PENNYLANE_CAPABILITIES;
  readonly descriptor = PENNYLANE_DESCRIPTOR;
  readonly environment: AccountingEnvironment;

  private client: IPennylaneClient;
  private readonly defaultVatRate?: string;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
    customClient?: IPennylaneClient,
  ) {
    super();
    this.environment = environment;
    this.defaultVatRate = credentials?.defaultVatRate || 'FR_200';

    if (customClient) {
      this.client = customClient;
    } else if (this.environment === 'MOCK') {
      this.client = new PennylaneMockClient();
    } else if (this.environment === 'TEST') {
      this.client = new PennylaneTestClient(credentials);
    } else {
      this.client = new PennylaneProductionClient(credentials);
    }
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError(
        'PENNYLANE',
        'Pennylane entegrasyonu yalnızca MOCK ortamında desteklenir.',
      );
    }

    return {
      success: true,
      message: 'Pennylane MOCK ortam bağlantısı başarılı.',
      environment: this.environment,
    };
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('PENNYLANE', this.environment);
    }

    // 1. Müşteriyi (customer) bul veya oluştur (§2.2: v2'de müşteri faturayla birlikte yaratılamaz)
    const custRef =
      request.contact?.id ||
      request.contact?.taxNumber ||
      request.contact?.email ||
      request.contact?.name ||
      'CUST-DEFAULT';

    let customer = await this.client.findCustomerByExternalReference(custRef);
    if (!customer) {
      customer = await this.client.createCustomer({
        name: request.contact?.name || 'Müşteri ' + custRef,
        reg_no: request.contact?.taxNumber,
        emails: request.contact?.email ? [request.contact.email] : undefined,
        phone: request.contact?.phone,
        address: {
          address: request.contact?.address,
          city: request.contact?.city,
          country_alpha2: 'FR',
        },
        external_reference: custRef,
      });
    }

    // 2. Fatura akışını yürüt: draft: true -> geri oku -> mutabakat (0.05) -> kesinleştir (§5.1)
    return PennylaneInvoiceFlow.executeCreateInvoice(
      this.client,
      request,
      customer.id,
    );
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('PENNYLANE', this.environment);
    }

    const custPayload = PennylaneRequestMapper.toCustomerRequest(request);
    const existing = custPayload.external_reference
      ? await this.client.findCustomerByExternalReference(custPayload.external_reference)
      : null;

    if (existing) {
      return PennylaneResponseMapper.toContactResult(existing);
    }

    const created = await this.client.createCustomer(custPayload);
    return PennylaneResponseMapper.toContactResult(created);
  }

  async recordPayment(_request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('PENNYLANE', this.environment);
    }

    // §5.6: Tahsilat uçları bu turda DOCUMENTATION_REQUIRED olarak işaretlenmiştir
    throw new IntegrationNotVerifiedError(
      'PENNYLANE',
      'Pennylane tahsilat akışı için banka/hesap detay dokümantasyonu gereklidir (DOCUMENTATION_REQUIRED).',
    );
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('PENNYLANE', this.environment);
    }

    const prodPayload = PennylaneRequestMapper.toProductRequest(request);
    const created = await this.client.createProduct(prodPayload);
    return PennylaneResponseMapper.toProductResult(created);
  }

  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('PENNYLANE', this.environment);
    }

    const doc = await this.client.findInvoiceByExternalReference(referenceCode);
    if (!doc) {
      return null;
    }
    return PennylaneResponseMapper.toInvoiceResult(doc, false);
  }

  async cancelInvoice(
    invoiceId: string,
  ): Promise<{ success: boolean; cancellationType: 'voided' | 'credit_note'; message: string }> {
    if (this.environment !== 'MOCK') {
      throw new IntegrationNotVerifiedError('PENNYLANE', this.environment);
    }

    // Conformance Rule #18: İptal öncesi mevcut durum okunmalıdır
    const id = parseInt(invoiceId, 10);
    if (isNaN(id)) {
      throw new BadRequestException(`Geçersiz fatura ID formatı: ${invoiceId}`);
    }

    const invoice = await this.client.getInvoice(id);
    const path = PennylaneStatusMapper.determineCancellationPath(invoice.draft);

    if (path === 'DIRECT_DELETE') {
      await this.client.deleteDraftInvoice(id);
      return {
        success: true,
        cancellationType: 'voided',
        message: 'Pennylane taslak faturası başarıyla silindi (DIRECT_DELETE).',
      };
    } else {
      throw new BadRequestException(
        `Pennylane faturası (${invoice.invoice_number || invoiceId}) kesinleştirilmiştir. Fransa vergi mevzuatı gereği kesinleşen faturalar doğrudan silinemez; alacak dekontu (credit note / avoir) oluşturulmalıdır.`,
      );
    }
  }
}
