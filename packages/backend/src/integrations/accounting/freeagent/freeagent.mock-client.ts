import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IFreeAgentClient, validateFreeAgentPagination } from './freeagent.client';
import { FreeAgentUriHelper } from './freeagent.uri';
import {
  FreeAgentBankAccount,
  FreeAgentBankTransactionExplanation,
  FreeAgentCategory,
  FreeAgentCompany,
  FreeAgentContact,
  FreeAgentInvoice,
  FreeAgentInvoiceTransition,
  FreeAgentPaginatedResponse,
  FreeAgentPaginationParams,
  FreeAgentUser,
} from './freeagent.types';

export class FreeAgentMockClient implements IFreeAgentClient {
  private invoices = new Map<string, FreeAgentInvoice>();
  private contacts = new Map<string, FreeAgentContact>();
  private categories = new Map<string, FreeAgentCategory>();
  private bankAccounts = new Map<string, FreeAgentBankAccount>();
  private bankExplanations = new Map<string, FreeAgentBankTransactionExplanation>();

  private invoiceIdCounter = 1000;
  private invoiceNumberCounter = 20000;
  private contactIdCounter = 100;
  private explanationIdCounter = 500;

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData(): void {
    // Şirket
    // Kategoriler (§3)
    this.categories.set('001', {
      url: 'https://api.sandbox.freeagent.com/v2/categories/001',
      nominal_code: '001',
      description: 'Sales (Standart Satış Geliri)',
      category_group: 'Income',
      allowable_for_tax: true,
      auto_sales_tax_rate: 20,
    });
    this.categories.set('002', {
      url: 'https://api.sandbox.freeagent.com/v2/categories/002',
      nominal_code: '002',
      description: 'Consulting Income (Danışmanlık Geliri)',
      category_group: 'Income',
      allowable_for_tax: true,
      auto_sales_tax_rate: 20,
    });

    // Banka Hesabı
    this.bankAccounts.set('1', {
      url: 'https://api.sandbox.freeagent.com/v2/bank_accounts/1',
      id: '1',
      name: 'Business Current Account',
      bank_name: 'Barclays Bank UK',
      type: 'StandardBankAccount',
      currency: 'GBP',
      current_balance: 50000,
      primary: true,
    });

    // Cari / Müşteri
    const contactId = '10';
    this.contacts.set(contactId, {
      url: `https://api.sandbox.freeagent.com/v2/contacts/${contactId}`,
      id: contactId,
      name: 'Acme UK Global Ltd',
      organisation_name: 'Acme UK Global Ltd',
      first_name: 'John',
      last_name: 'Doe',
      email: 'finance@acmeuk.example.com',
      country: 'United Kingdom',
      charge_sales_tax: 'Auto',
    });

    // Mevcut Örnek Fatura
    const initialInvoiceId = 'inv-1';
    this.invoices.set(initialInvoiceId, {
      url: `https://api.sandbox.freeagent.com/v2/invoices/${initialInvoiceId}`,
      id: initialInvoiceId,
      reference: 'INV-10001',
      contact: `https://api.sandbox.freeagent.com/v2/contacts/${contactId}`,
      dated_on: '2026-09-11',
      due_on: '2026-09-25',
      status: 'Open',
      currency: 'GBP',
      net_value: 100,
      sales_tax_value: 20,
      total_value: 120,
      paid_value: 0,
      due_value: 120,
      po_reference: 'KROP-REF-SEED-1',
      invoice_items: [
        {
          description: 'E-Ticaret Yazılım Lisansı',
          price: 100,
          quantity: 1,
          category: 'https://api.sandbox.freeagent.com/v2/categories/001',
          sales_tax_rate: 20,
        },
      ],
    });
  }

  async getCompany(): Promise<FreeAgentCompany> {
    return {
      url: 'https://api.sandbox.freeagent.com/v2/company',
      name: 'KroptOS UK Ltd',
      subdomain: 'kroptos-demo',
      type: 'UkLimitedCompany',
      currency: 'GBP',
      company_start_date: '2024-01-01',
      freeagent_start_date: '2024-01-01',
      country: 'United Kingdom',
    };
  }

  async getCurrentUser(): Promise<FreeAgentUser> {
    return {
      url: 'https://api.sandbox.freeagent.com/v2/users/1',
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@kroptos.example.com',
      role: 'Owner',
      permission_level: 8,
    };
  }

  async listContacts(
    params?: FreeAgentPaginationParams,
  ): Promise<FreeAgentPaginatedResponse<FreeAgentContact>> {
    const { page, per_page } = validateFreeAgentPagination(params);
    const all = Array.from(this.contacts.values());
    const start = (page - 1) * per_page;
    const items = all.slice(start, start + per_page);

    return {
      items,
      totalCount: all.length,
      nextPage: start + per_page < all.length ? page + 1 : undefined,
      prevPage: page > 1 ? page - 1 : undefined,
    };
  }

  async getContact(idOrUrl: string | number): Promise<FreeAgentContact> {
    const id = FreeAgentUriHelper.extractResourceId(idOrUrl, 'contacts');
    const contact = this.contacts.get(id);
    if (!contact) {
      throw new NotFoundException(`FreeAgent Contact bulunamadı: ${id}`);
    }
    return contact;
  }

  async createContact(contact: Partial<FreeAgentContact>): Promise<FreeAgentContact> {
    const id = String(++this.contactIdCounter);
    const created: FreeAgentContact = {
      url: `https://api.sandbox.freeagent.com/v2/contacts/${id}`,
      id,
      name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      organisation_name: contact.organisation_name,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone_number: contact.phone_number,
      address1: contact.address1,
      town: contact.town,
      postcode: contact.postcode,
      country: contact.country || 'United Kingdom',
      charge_sales_tax: contact.charge_sales_tax || 'Auto',
    };
    this.contacts.set(id, created);
    return created;
  }

  async listCategories(): Promise<FreeAgentCategory[]> {
    return Array.from(this.categories.values());
  }

  async listBankAccounts(): Promise<FreeAgentBankAccount[]> {
    return Array.from(this.bankAccounts.values());
  }

  async createDraftInvoice(invoice: Partial<FreeAgentInvoice>): Promise<FreeAgentInvoice> {
    // §5.3 YASAK KONTROLÜ: Giden istekte sunucu hesaplama alanları yer alamaz!
    if (
      invoice.net_value !== undefined ||
      invoice.sales_tax_value !== undefined ||
      invoice.total_value !== undefined
    ) {
      throw new BadRequestException(
        '[FreeAgent MockClient] Güvenlik ihlali: Hesaplanan alanlar (net_value, total_value, sales_tax_value) istek gövdesinde gönderilemez (§5.3).',
      );
    }

    // §3: Her kalemde geçerli kategori URI'si olmalıdır
    for (const item of invoice.invoice_items || []) {
      if (!item.category) {
        throw new BadRequestException(
          '[FreeAgent MockClient] Kalemde kategori URI eksik. FreeAgent kategori URI zorunludur (§3).',
        );
      }
    }

    const id = String(++this.invoiceIdCounter);
    const reference = invoice.reference || `INV-${++this.invoiceNumberCounter}`;

    // Sunucu tutar hesaplama simülasyonu (§5.3)
    let net = 0;
    let tax = 0;

    for (const item of invoice.invoice_items || []) {
      const lineNet = item.price * item.quantity;
      const rate = item.sales_tax_rate || 0;
      const lineTax = (lineNet * rate) / 100;
      net += lineNet;
      tax += lineTax;
    }

    const netValue = Number(net.toFixed(2));
    const salesTaxValue = Number(tax.toFixed(2));
    const totalValue = Number((netValue + salesTaxValue).toFixed(2));

    const created: FreeAgentInvoice = {
      url: `https://api.sandbox.freeagent.com/v2/invoices/${id}`,
      id,
      contact: invoice.contact!,
      dated_on: invoice.dated_on!,
      due_on: invoice.due_on || invoice.dated_on!,
      reference,
      currency: invoice.currency || 'GBP',
      status: 'Draft', // Zorunlu taslak başlama (§5.3)
      net_value: netValue,
      sales_tax_value: salesTaxValue,
      total_value: totalValue,
      paid_value: 0,
      due_value: totalValue,
      po_reference: invoice.po_reference,
      comments: invoice.comments,
      invoice_items: invoice.invoice_items || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.invoices.set(id, created);
    return created;
  }

  async getInvoice(idOrUrl: string | number): Promise<FreeAgentInvoice> {
    const id = FreeAgentUriHelper.extractResourceId(idOrUrl, 'invoices');
    const invoice = this.invoices.get(id);
    if (!invoice) {
      throw new NotFoundException(`FreeAgent Invoice bulunamadı: ${id}`);
    }
    return invoice;
  }

  async listInvoices(
    params?: FreeAgentPaginationParams,
  ): Promise<FreeAgentPaginatedResponse<FreeAgentInvoice>> {
    const { page, per_page, view } = validateFreeAgentPagination(params);
    let all = Array.from(this.invoices.values());

    if (view === 'draft') {
      all = all.filter((i) => i.status === 'Draft');
    } else if (view === 'open') {
      all = all.filter((i) => i.status === 'Open');
    } else if (view === 'paid') {
      all = all.filter((i) => i.status === 'Paid');
    }

    const start = (page - 1) * per_page;
    const items = all.slice(start, start + per_page);

    return {
      items,
      totalCount: all.length,
      nextPage: start + per_page < all.length ? page + 1 : undefined,
      prevPage: page > 1 ? page - 1 : undefined,
    };
  }

  async transitionInvoice(
    idOrUrl: string | number,
    transition: FreeAgentInvoiceTransition,
  ): Promise<FreeAgentInvoice> {
    // §5.2 YASAK KONTROLLERİ: send_email ve mark_as_scheduled ASLA çağrılamaz
    if ((transition as any) === 'send_email') {
      throw new BadRequestException(
        '[FreeAgent MockClient] Güvenlik ihlali: send_email çağrısı kesinlikle yasaktır (§5.2).',
      );
    }
    if (transition === 'mark_as_scheduled') {
      throw new BadRequestException(
        '[FreeAgent MockClient] Güvenlik ihlali: mark_as_scheduled çağrısı yasaktır (§5.2).',
      );
    }

    const id = FreeAgentUriHelper.extractResourceId(idOrUrl, 'invoices');
    const invoice = await this.getInvoice(id);

    if (transition === 'mark_as_sent') {
      invoice.status = 'Open';
    } else if (transition === 'mark_as_draft') {
      invoice.status = 'Draft';
    } else if (transition === 'mark_as_cancelled') {
      invoice.status = 'Cancelled' as any;
    }

    invoice.updated_at = new Date().toISOString();
    this.invoices.set(id, invoice);
    return invoice;
  }

  async deleteInvoice(idOrUrl: string | number): Promise<{ success: boolean }> {
    const id = FreeAgentUriHelper.extractResourceId(idOrUrl, 'invoices');
    const invoice = await this.getInvoice(id);
    if (invoice.status !== 'Draft') {
      throw new BadRequestException(
        'Sadece taslak (Draft) durumundaki faturalar FreeAgent üzerinden silinebilir.',
      );
    }
    this.invoices.delete(id);
    return { success: true };
  }

  async createBankTransactionExplanation(
    explanation: FreeAgentBankTransactionExplanation,
  ): Promise<FreeAgentBankTransactionExplanation> {
    const id = String(++this.explanationIdCounter);
    const invoiceId = FreeAgentUriHelper.extractResourceId(explanation.paid_invoice, 'invoices');
    const invoice = await this.getInvoice(invoiceId);

    const paidVal = (invoice.paid_value || 0) + explanation.gross_value;
    invoice.paid_value = Number(paidVal.toFixed(2));
    invoice.due_value = Number(Math.max(0, (invoice.total_value || 0) - invoice.paid_value).toFixed(2));

    if (invoice.paid_value >= (invoice.total_value || 0)) {
      invoice.status = 'Paid';
    }

    const created: FreeAgentBankTransactionExplanation = {
      ...explanation,
      id,
      url: `https://api.sandbox.freeagent.com/v2/bank_transaction_explanations/${id}`,
    };

    this.bankExplanations.set(id, created);
    return created;
  }
}
