import {
  AccountingAmountMismatchError,
  AccountingApiError,
  AccountingRateLimitExceededError,
} from '../core/AccountingErrors';
import {
  AccountingContactRequest,
  AccountingContactResult,
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
  AccountingPaymentRequest,
  AccountingPaymentResult,
  AccountingProductRequest,
  AccountingProductResult,
  AccountingTestConnectionResult,
} from '../core/AccountingTypes';
import { IParasutClient } from './parasut.client';
import { ParasutRequestMapper } from './parasut.request-mapper';

export class ParasutMockClient implements IParasutClient {
  private contacts: Map<string, any> = new Map();
  private products: Map<string, any> = new Map();
  private invoices: Map<string, any> = new Map();
  private invoicesByRef: Map<string, any> = new Map();
  private payments: Map<string, any> = new Map();

  private invoiceCounter = 1000;
  private contactCounter = 500;
  private productCounter = 200;
  private paymentCounter = 300;

  constructor(private readonly credentials: Record<string, any> = {}) {}

  async testConnection(): Promise<AccountingTestConnectionResult> {
    if (this.credentials.username === 'invalid@kroptos.com' || this.credentials.password === 'wrong-password') {
      return {
        success: false,
        message: 'Paraşüt kimlik doğrulama başarısız: Geçersiz kullanıcı adı veya şifre.',
        environment: 'MOCK',
      };
    }

    return {
      success: true,
      message: 'Paraşüt MOCK bağlantısı başarıyla doğrulandı.',
      companyId: this.credentials.companyId || '123456',
      companyName: 'KroptOS Test Ticaret A.Ş. (Mock)',
      environment: 'MOCK',
    };
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    // Check error triggers from referenceCode
    if (request.referenceCode.includes('TRIGGER_NETWORK_FAIL')) {
      throw new AccountingApiError('PARASUT', 500, 'Mock paraşüt ağ hatası simülasyonu');
    }
    if (request.referenceCode.includes('TRIGGER_RATE_LIMIT')) {
      throw new AccountingRateLimitExceededError('PARASUT', 30);
    }
    if (request.referenceCode.includes('TRIGGER_400_DETAIL')) {
      throw new AccountingApiError('PARASUT', 400, 'Geçersiz KDV oranı (Mock)');
    }

    // Validate request structure & amount consistency
    if (!request.items || request.items.length === 0) {
      throw new AccountingAmountMismatchError('Faturada en az bir kalem bulunmalıdır.');
    }

    // Amount arithmetic validation via mapper
    ParasutRequestMapper.toSalesInvoiceResource(request);

    // If invoice already exists by reference in mock store, return it (idempotency simulation)
    const existing = this.invoicesByRef.get(request.referenceCode);
    if (existing) {
      return {
        externalId: existing.id,
        externalNumber: existing.attributes.invoice_no,
        rawResponse: { data: existing },
      };
    }

    this.invoiceCounter += 1;
    const externalId = `parasut-inv-${this.invoiceCounter}`;
    const externalNumber = `KRP${new Date().getFullYear()}${String(this.invoiceCounter).padStart(6, '0')}`;

    const invoiceResource = {
      id: externalId,
      type: 'sales_invoices',
      attributes: {
        item_type: 'invoice',
        invoice_no: externalNumber,
        issue_date: request.issueDate,
        due_date: request.dueDate || request.issueDate,
        currency: request.currency,
        net_total: request.subtotal,
        gross_total: request.grandTotal,
        description: request.notes,
      },
      relationships: {
        contact: {
          data: {
            id: request.contact.id || `contact-${this.contactCounter}`,
            type: 'contacts',
          },
        },
      },
    };

    this.invoices.set(externalId, invoiceResource);
    this.invoicesByRef.set(request.referenceCode, invoiceResource);

    return {
      externalId,
      externalNumber,
      rawResponse: { data: invoiceResource },
    };
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    if (request.referenceCode.includes('TRIGGER_PAYMENT_FAIL')) {
      throw new AccountingApiError('PARASUT', 400, 'Fatura bakiyesinden yüksek tahsilat tutarı');
    }

    this.paymentCounter += 1;
    const externalId = `parasut-pay-${this.paymentCounter}`;

    const paymentResource = {
      id: externalId,
      type: 'payments',
      attributes: {
        date: request.paymentDate,
        amount: request.amount,
        description: request.notes,
      },
      relationships: {
        payable: {
          data: {
            id: request.invoiceExternalId,
            type: 'sales_invoices',
          },
        },
      },
    };

    this.payments.set(externalId, paymentResource);

    return {
      externalId,
      rawResponse: { data: paymentResource },
    };
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    const key = request.kroptosKey;
    const existing = this.contacts.get(key);
    if (existing) {
      return {
        externalId: existing.id,
        rawResponse: { data: existing },
      };
    }

    this.contactCounter += 1;
    const externalId = `parasut-cnt-${this.contactCounter}`;

    const contactResource = {
      id: externalId,
      type: 'contacts',
      attributes: {
        name: request.name,
        email: request.email,
        phone: request.phone,
        tax_number: request.taxNumber,
        tax_office: request.taxOffice,
        address: request.address,
        city: request.city,
        district: request.district,
      },
    };

    this.contacts.set(key, contactResource);

    return {
      externalId,
      rawResponse: { data: contactResource },
    };
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    const existing = this.products.get(request.sku);
    if (existing) {
      return {
        externalId: existing.id,
        code: existing.attributes.code,
        rawResponse: { data: existing },
      };
    }

    this.productCounter += 1;
    const externalId = `parasut-prd-${this.productCounter}`;

    const productResource = {
      id: externalId,
      type: 'products',
      attributes: {
        name: request.name,
        code: request.code || request.sku,
        vat_rate: request.vatRate || 20,
        currency: request.currency || 'TRY',
      },
    };

    this.products.set(request.sku, productResource);

    return {
      externalId,
      code: productResource.attributes.code,
      rawResponse: { data: productResource },
    };
  }

  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    const existing = this.invoicesByRef.get(referenceCode);
    if (!existing) return null;

    return {
      externalId: existing.id,
      externalNumber: existing.attributes.invoice_no,
      rawResponse: { data: existing },
    };
  }

  reset(): void {
    this.contacts.clear();
    this.products.clear();
    this.invoices.clear();
    this.invoicesByRef.clear();
    this.payments.clear();
    this.invoiceCounter = 1000;
  }
}
