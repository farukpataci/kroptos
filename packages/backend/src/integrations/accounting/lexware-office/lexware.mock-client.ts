import { ILexwareClient } from './lexware.client';
import {
  LexwareArticle,
  LexwareContact,
  LexwareCreateInvoiceRequest,
  LexwareInvoice,
  LexwarePageResponse,
} from './lexware.types';
import { LexwareErrorMapper } from './lexware.error-mapper';
import { AccountingApiError } from '../core/AccountingErrors';

export class LexwareMockClient implements ILexwareClient {
  private invoices = new Map<string, LexwareInvoice>();
  private contacts = new Map<string, LexwareContact>();
  private articles = new Map<string, LexwareArticle>();
  private nextInvoiceSeq = 1001;

  // Simulation flags for comprehensive test matrix (§8)
  public simulateAmountMismatch = false;
  public simulateVersionConflictCount = 0;
  public simulateValidation406?: { i18nKey: string; message?: string };
  public simulateRateLimit429Count = 0;
  public simulateDraftCreationTimeout = false;
  public simulateFinalizeTimeout = false;
  public requestHistory: Array<{ method: string; path: string; body?: any }> = [];

  async createDraftInvoice(data: LexwareCreateInvoiceRequest): Promise<LexwareInvoice> {
    this.requestHistory.push({ method: 'POST', path: '/invoices', body: data });

    if (this.simulateDraftCreationTimeout) {
      throw new Error('ETIMEDOUT: Connection timed out while creating draft invoice');
    }

    if (this.simulateValidation406) {
      const err = this.simulateValidation406;
      this.simulateValidation406 = undefined;
      throw LexwareErrorMapper.mapError(406, {
        i18nKey: err.i18nKey,
        message: err.message || 'Validation failed in mock',
      });
    }

    if (this.simulateRateLimit429Count > 0) {
      this.simulateRateLimit429Count--;
      throw LexwareErrorMapper.mapError(429, {});
    }

    const id = `inv-mock-${Math.random().toString(36).substring(2, 9)}`;
    const version = 1;

    // Simulate server side total calculation & validation (§5.6)
    let totalGross = data.totalPrice.totalGrossAmount;
    let totalNet = data.totalPrice.totalNetAmount;
    let totalTax = data.totalPrice.totalTaxAmount;

    if (this.simulateAmountMismatch) {
      // Intentionally deviate server calculated total by 5.00 EUR
      totalGross += 5.0;
    }

    const invoice: LexwareInvoice = {
      id,
      version,
      voucherStatus: 'draft',
      voucherNumber: undefined, // Draft has no official voucher number yet
      voucherDate: data.voucherDate,
      address: data.address,
      lineItems: data.lineItems,
      totalPrice: {
        currency: 'EUR',
        totalNetAmount: totalNet,
        totalGrossAmount: totalGross,
        totalTaxAmount: totalTax,
      },
      taxAmounts: data.taxAmounts,
      taxConditions: data.taxConditions,
      introduction: data.introduction,
      remark: data.remark,
      title: data.title,
    };

    this.invoices.set(id, invoice);
    return invoice;
  }

  async getInvoice(id: string): Promise<LexwareInvoice> {
    this.requestHistory.push({ method: 'GET', path: `/invoices/${id}` });
    const inv = this.invoices.get(id);
    if (!inv) {
      throw LexwareErrorMapper.mapError(404, { message: `Invoice ${id} not found` });
    }
    return JSON.parse(JSON.stringify(inv));
  }

  async finalizeInvoice(id: string, version: number): Promise<LexwareInvoice> {
    this.requestHistory.push({ method: 'POST', path: `/invoices/${id}/finalize`, body: { version } });

    if (this.simulateFinalizeTimeout) {
      throw new Error('ETIMEDOUT: Connection timed out while finalizing invoice');
    }

    if (this.simulateVersionConflictCount > 0) {
      this.simulateVersionConflictCount--;
      throw LexwareErrorMapper.mapError(409, { message: 'Version conflict' });
    }

    const inv = this.invoices.get(id);
    if (!inv) {
      throw LexwareErrorMapper.mapError(404, { message: `Invoice ${id} not found` });
    }

    if (inv.voucherStatus !== 'draft') {
      // §3.3: Cannot finalize an already open or voided invoice
      throw LexwareErrorMapper.mapError(406, {
        i18nKey: 'voucher_closed',
        message: 'Invoice is already finalized and cannot be modified',
      });
    }

    if (version !== inv.version) {
      throw LexwareErrorMapper.mapError(409, { message: 'Version mismatch' });
    }

    const officialNumber = `RE-2026-${this.nextInvoiceSeq++}`;
    inv.voucherStatus = 'open';
    inv.voucherNumber = officialNumber;
    inv.version += 1;

    this.invoices.set(id, inv);
    return JSON.parse(JSON.stringify(inv));
  }

  async deleteDraftInvoice(id: string): Promise<void> {
    this.requestHistory.push({ method: 'DELETE', path: `/invoices/${id}` });
    const inv = this.invoices.get(id);
    if (!inv) {
      throw LexwareErrorMapper.mapError(404, { message: `Invoice ${id} not found` });
    }
    if (inv.voucherStatus !== 'draft') {
      // §3.3: Finalized invoice CANNOT be deleted
      throw LexwareErrorMapper.mapError(406, {
        i18nKey: 'voucher_closed',
        message: 'Finalized invoices cannot be deleted. Use credit note instead.',
      });
    }
    this.invoices.delete(id);
  }

  async createContact(data: Partial<LexwareContact>): Promise<LexwareContact> {
    this.requestHistory.push({ method: 'POST', path: '/contacts', body: data });
    const id = `cnt-${Math.random().toString(36).substring(2, 9)}`;
    const contact: LexwareContact = {
      id,
      version: 1,
      roles: data.roles || { customer: {} },
      company: data.company,
      person: data.person,
      addresses: data.addresses,
      emailAddresses: data.emailAddresses,
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async getContact(id: string): Promise<LexwareContact> {
    this.requestHistory.push({ method: 'GET', path: `/contacts/${id}` });
    const cnt = this.contacts.get(id);
    if (!cnt) {
      throw LexwareErrorMapper.mapError(404, { message: `Contact ${id} not found` });
    }
    return JSON.parse(JSON.stringify(cnt));
  }

  async createArticle(data: Partial<LexwareArticle>): Promise<LexwareArticle> {
    this.requestHistory.push({ method: 'POST', path: '/articles', body: data });
    const id = `art-${Math.random().toString(36).substring(2, 9)}`;
    const article: LexwareArticle = {
      id,
      version: 1,
      title: data.title || 'Untitled Article',
      description: data.description,
      articleNumber: data.articleNumber,
      unitName: data.unitName || 'Stück',
      price: data.price || {
        leadingPrice: 'NET',
        netPrice: 10,
        grossPrice: 11.9,
        taxRatePercentage: 19,
      },
    };
    this.articles.set(id, article);
    return article;
  }

  async getArticle(id: string): Promise<LexwareArticle> {
    this.requestHistory.push({ method: 'GET', path: `/articles/${id}` });
    const art = this.articles.get(id);
    if (!art) {
      throw LexwareErrorMapper.mapError(404, { message: `Article ${id} not found` });
    }
    return JSON.parse(JSON.stringify(art));
  }

  async listInvoices(page = 0, size = 25): Promise<LexwarePageResponse<LexwareInvoice>> {
    const safeSize = Math.min(Math.max(1, size), 250); // §3.5: Max 250
    this.requestHistory.push({ method: 'GET', path: `/invoices?page=${page}&size=${safeSize}` });
    const all = Array.from(this.invoices.values());
    const totalElements = all.length;
    const totalPages = Math.ceil(totalElements / safeSize) || 1;
    const start = page * safeSize;
    const content = all.slice(start, start + safeSize);

    return {
      content,
      first: page === 0,
      last: page >= totalPages - 1,
      number: page,
      numberOfElements: content.length,
      size: safeSize,
      totalElements,
      totalPages,
    };
  }

  async getProfile(): Promise<any> {
    return {
      organizationId: 'org-mock-lexware-123',
      companyName: 'Musterfirma GmbH',
    };
  }
}
