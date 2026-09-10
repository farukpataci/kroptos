import { IBusinessCentralClient } from './bc.client';
import {
  BusinessCentralCompany,
  BusinessCentralCustomer,
  BusinessCentralItem,
  BusinessCentralSalesInvoiceHeader,
  BusinessCentralSalesInvoiceLine,
} from './bc.types';

// Fixtures
import draftFixture from './__fixtures__/invoice-draft.fixture.json';
import postedFixture from './__fixtures__/invoice-posted.fixture.json';
import companiesFixture from './__fixtures__/companies.fixture.json';
import customerFixture from './__fixtures__/customer.fixture.json';
import itemFixture from './__fixtures__/item.fixture.json';

export class BusinessCentralMockClient implements IBusinessCentralClient {
  private invoices: Map<string, BusinessCentralSalesInvoiceHeader> = new Map();
  private lines: Map<string, BusinessCentralSalesInvoiceLine[]> = new Map();
  private customers: Map<string, BusinessCentralCustomer> = new Map();
  private items: Map<string, BusinessCentralItem> = new Map();
  private invoiceCounter = 103001;

  constructor(private readonly credentials: Record<string, any> = {}) {
    // Seed default fixture data
    const defaultDraft = JSON.parse(JSON.stringify(draftFixture)) as BusinessCentralSalesInvoiceHeader;
    this.invoices.set(defaultDraft.id!, defaultDraft);
    if (defaultDraft.salesInvoiceLines) {
      this.lines.set(defaultDraft.id!, defaultDraft.salesInvoiceLines);
    }
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    companyName?: string;
    companyId?: string;
  }> {
    const company = companiesFixture[0];
    return {
      success: true,
      message: 'Microsoft Dynamics 365 Business Central Online mock bağlantısı başarılı.',
      companyName: company.displayName,
      companyId: company.id,
    };
  }

  async createDraftInvoice(
    header: Partial<BusinessCentralSalesInvoiceHeader>,
  ): Promise<BusinessCentralSalesInvoiceHeader> {
    const id = `bc-inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const draft: BusinessCentralSalesInvoiceHeader = {
      id,
      number: `INV-DRAFT-${Math.floor(Math.random() * 10000)}`,
      externalDocumentNumber: header.externalDocumentNumber,
      invoiceDate: header.invoiceDate || new Date().toISOString().slice(0, 10),
      postingDate: header.postingDate || new Date().toISOString().slice(0, 10),
      dueDate: header.dueDate,
      customerId: header.customerId || 'c0a00001-1111-2222-3333-444455556666',
      customerNumber: '10000',
      customerName: header.customerName || 'Test Customer A.S.',
      currencyCode: header.currencyCode || 'TRY',
      status: 'Draft',
      totalAmountExcludingTax: 0,
      totalTaxAmount: 0,
      totalAmountIncludingTax: 0,
      '@odata.etag': `W/"JzQ0OzE2ODkxNDEzNDc4MzEzODcxNzcxOzAwOyc="`,
      lastModifiedDateTime: new Date().toISOString(),
    };

    this.invoices.set(id, draft);
    this.lines.set(id, []);
    return draft;
  }

  async createInvoiceLine(
    line: Partial<BusinessCentralSalesInvoiceLine>,
  ): Promise<BusinessCentralSalesInvoiceLine> {
    const invoiceId = line.documentId!;
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error(`Business Central fatura bulunamadı: ${invoiceId}`);
    }

    const lineId = `bc-line-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const qty = Number(line.quantity || 1);
    const price = Number(line.unitPrice || 0);
    const subtotal = qty * price;
    // Mock standard 20% VAT calculation mimicking BC's posting setup
    const taxRate = 0.20;
    const taxAmount = Number((subtotal * taxRate).toFixed(2));
    const totalWithTax = Number((subtotal + taxAmount).toFixed(2));

    const createdLine: BusinessCentralSalesInvoiceLine = {
      id: lineId,
      documentId: invoiceId,
      sequence: line.sequence || 10000,
      lineType: line.lineType || 'Item',
      itemId: line.itemId,
      lineObjectNumber: line.lineObjectNumber,
      description: line.description || 'Ürün Kalemi',
      quantity: qty,
      unitPrice: price,
      discountAmount: line.discountAmount,
      discountPercent: line.discountPercent,
      taxCode: line.taxCode || 'VAT20',
      amountExcludingTax: subtotal,
      taxPercent: 20,
      totalTaxAmount: taxAmount,
      amountIncludingTax: totalWithTax,
      '@odata.etag': `W/"JzIwOzE2ODkxNDEzNDc4MzEzODcxNzcxOzAwOyc="`,
    };

    const currentLines = this.lines.get(invoiceId) || [];
    currentLines.push(createdLine);
    this.lines.set(invoiceId, currentLines);

    // Update parent invoice calculated totals (BC does this automatically)
    invoice.totalAmountExcludingTax = Number(
      currentLines.reduce((acc, l) => acc + (l.amountExcludingTax || 0), 0).toFixed(2),
    );
    invoice.totalTaxAmount = Number(
      currentLines.reduce((acc, l) => acc + (l.totalTaxAmount || 0), 0).toFixed(2),
    );
    invoice.totalAmountIncludingTax = Number(
      currentLines.reduce((acc, l) => acc + (l.amountIncludingTax || 0), 0).toFixed(2),
    );

    return createdLine;
  }

  async getInvoice(
    id: string,
    expandLines = false,
  ): Promise<BusinessCentralSalesInvoiceHeader> {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      // Fallback to posted fixture if matching ID
      if (id === postedFixture.id) {
        return postedFixture as BusinessCentralSalesInvoiceHeader;
      }
      throw new Error(`Business Central faturası bulunamadı: ${id}`);
    }

    const result = { ...invoice };
    if (expandLines) {
      result.salesInvoiceLines = this.lines.get(id) || [];
    }
    return result;
  }

  async postInvoice(id: string): Promise<void> {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      throw new Error(`Post edilecek fatura bulunamadı: ${id}`);
    }

    invoice.status = 'Open';
    invoice.number = String(this.invoiceCounter++);
    invoice['@odata.etag'] = `W/"JzQ0OzE2ODkxNDEzNDc4MzEzODcxNzcxOzAxOyc="`;
    invoice.lastModifiedDateTime = new Date().toISOString();
  }

  async cancelInvoice(id: string): Promise<void> {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      throw new Error(`İptal edilecek fatura bulunamadı: ${id}`);
    }

    invoice.status = 'Canceled';
    invoice.lastModifiedDateTime = new Date().toISOString();
  }

  async deleteDraftInvoice(id: string, _etag?: string): Promise<void> {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      return;
    }
    this.invoices.delete(id);
    this.lines.delete(id);
  }

  async findInvoiceByReference(
    referenceCode: string,
  ): Promise<BusinessCentralSalesInvoiceHeader | null> {
    for (const inv of this.invoices.values()) {
      if (inv.externalDocumentNumber === referenceCode) {
        return inv;
      }
    }
    return null;
  }

  async syncCustomer(
    customer: Partial<BusinessCentralCustomer>,
  ): Promise<BusinessCentralCustomer> {
    const id = customer.id || `bc-cust-${Date.now()}`;
    const synced: BusinessCentralCustomer = {
      id,
      number: customer.number || 'CUST-001',
      displayName: customer.displayName || 'Mock Customer',
      type: customer.type || 'Company',
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      taxRegistrationNumber: customer.taxRegistrationNumber,
      addressLine1: customer.addressLine1,
      city: customer.city,
      country: customer.country || 'TR',
    };
    this.customers.set(id, synced);
    return synced;
  }

  async mapItem(item: Partial<BusinessCentralItem>): Promise<BusinessCentralItem> {
    const id = item.id || `bc-item-${Date.now()}`;
    const mapped: BusinessCentralItem = {
      id,
      number: item.number || 'ITEM-001',
      displayName: item.displayName || 'Mock Item',
      type: 'Inventory',
      unitPrice: item.unitPrice,
    };
    this.items.set(id, mapped);
    return mapped;
  }

  async getCompanies(): Promise<BusinessCentralCompany[]> {
    return companiesFixture as BusinessCentralCompany[];
  }
}
