import { IXeroClient } from './xero.client';
import {
  XeroConnection,
  XeroContact,
  XeroInvoice,
  XeroItem,
  XeroPayment,
  XeroTaxRate,
} from './xero.types';

import connectionsFixture from './__fixtures__/connections.fixture.json';
import contactsFixture from './__fixtures__/contacts.fixture.json';
import invoicesFixture from './__fixtures__/invoices.fixture.json';
import itemsFixture from './__fixtures__/items.fixture.json';
import paymentsFixture from './__fixtures__/payments.fixture.json';
import taxRatesFixture from './__fixtures__/tax-rates.fixture.json';

export class XeroMockClient implements IXeroClient {
  private invoices = new Map<string, XeroInvoice>();
  private contacts = new Map<string, XeroContact>();
  private items = new Map<string, XeroItem>();
  private payments = new Map<string, XeroPayment>();
  private counter = 1001;

  constructor(private readonly credentials: Record<string, any> = {}) {
    // Seed fixtures
    for (const inv of invoicesFixture as unknown as XeroInvoice[]) {
      if (inv.InvoiceID) this.invoices.set(inv.InvoiceID, inv);
      if (inv.Reference) this.invoices.set(`ref_${inv.Reference}`, inv);
    }
    for (const c of contactsFixture as unknown as XeroContact[]) {
      if (c.ContactID) this.contacts.set(c.ContactID, c);
      if (c.ContactNumber) this.contacts.set(`num_${c.ContactNumber}`, c);
    }
    for (const it of itemsFixture as unknown as XeroItem[]) {
      if (it.ItemID) this.items.set(it.ItemID, it);
      this.items.set(`code_${it.Code}`, it);
    }
    for (const p of paymentsFixture as unknown as XeroPayment[]) {
      if (p.PaymentID) this.payments.set(p.PaymentID, p);
    }
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    companyName?: string;
    companyId?: string;
  }> {
    if (this.credentials.clientId === 'invalid') {
      return {
        success: false,
        message: 'Invalid Xero credentials',
      };
    }

    const tenantId = this.credentials.tenantId || 'xero-tenant-uuid-demo-org';
    const connections = await this.getConnections();
    const conn = connections.find((c) => c.tenantId === tenantId);

    return {
      success: true,
      message: 'Xero Accounting API mock bağlantısı başarılı.',
      companyName: conn ? conn.tenantName : 'KroptOS Demo Global Ltd',
      companyId: tenantId,
    };
  }

  async createDraftInvoice(invoice: XeroInvoice): Promise<XeroInvoice> {
    const invoiceId = invoice.InvoiceID || `xero-inv-${Date.now()}-${this.counter++}`;
    const invoiceNumber = invoice.InvoiceNumber || `INV-${this.counter}`;

    let subTotal = 0;
    let totalTax = 0;

    const lineItems = invoice.LineItems.map((line, idx) => {
      const lineTotal = Number((line.Quantity * line.UnitAmount).toFixed(2));
      const lineTax =
        line.TaxAmount !== undefined
          ? line.TaxAmount
          : line.TaxType === 'ZERORATED'
          ? 0
          : Number((lineTotal * 0.2).toFixed(2));

      subTotal += lineTotal;
      totalTax += lineTax;

      return {
        ...line,
        LineItemID: line.LineItemID || `line-${idx + 1}-${invoiceId}`,
        LineAmount: lineTotal,
        TaxAmount: lineTax,
      };
    });

    const total = Number((subTotal + totalTax).toFixed(2));

    const created: XeroInvoice = {
      ...invoice,
      InvoiceID: invoiceId,
      InvoiceNumber: invoiceNumber,
      Status: 'DRAFT',
      LineItems: lineItems,
      SubTotal: subTotal,
      TotalTax: totalTax,
      Total: total,
      AmountDue: total,
      AmountPaid: 0,
      UpdatedDateUTC: new Date().toISOString(),
    };

    this.invoices.set(invoiceId, created);
    if (created.Reference) {
      this.invoices.set(`ref_${created.Reference}`, created);
    }

    return created;
  }

  async authorizeInvoice(invoiceId: string): Promise<XeroInvoice> {
    const existing = this.invoices.get(invoiceId);
    if (!existing) {
      throw new Error(`Xero invoice not found: ${invoiceId}`);
    }

    const authorized: XeroInvoice = {
      ...existing,
      Status: 'AUTHORISED',
      UpdatedDateUTC: new Date().toISOString(),
    };

    this.invoices.set(invoiceId, authorized);
    if (authorized.Reference) {
      this.invoices.set(`ref_${authorized.Reference}`, authorized);
    }

    return authorized;
  }

  async getInvoice(invoiceId: string): Promise<XeroInvoice | null> {
    return this.invoices.get(invoiceId) || null;
  }

  async findInvoiceByReference(reference: string): Promise<XeroInvoice | null> {
    return this.invoices.get(`ref_${reference}`) || null;
  }

  async createOrUpdateContact(contact: XeroContact): Promise<XeroContact> {
    const contactId = contact.ContactID || `xero-c-${Date.now()}-${this.counter++}`;
    const saved: XeroContact = {
      ...contact,
      ContactID: contactId,
      ContactStatus: 'ACTIVE',
    };

    this.contacts.set(contactId, saved);
    if (saved.ContactNumber) {
      this.contacts.set(`num_${saved.ContactNumber}`, saved);
    }
    return saved;
  }

  async createOrUpdateItem(item: XeroItem): Promise<XeroItem> {
    const itemId = item.ItemID || `xero-item-${Date.now()}-${this.counter++}`;
    const saved: XeroItem = {
      ...item,
      ItemID: itemId,
    };

    this.items.set(itemId, saved);
    this.items.set(`code_${saved.Code}`, saved);
    return saved;
  }

  async createPayment(payment: XeroPayment): Promise<XeroPayment> {
    const paymentId = payment.PaymentID || `xero-pay-${Date.now()}-${this.counter++}`;
    const saved: XeroPayment = {
      ...payment,
      PaymentID: paymentId,
      Status: 'AUTHORISED',
    };

    this.payments.set(paymentId, saved);
    return saved;
  }

  async getConnections(): Promise<XeroConnection[]> {
    return connectionsFixture as XeroConnection[];
  }

  async getTaxRates(): Promise<XeroTaxRate[]> {
    return taxRatesFixture as XeroTaxRate[];
  }
}
