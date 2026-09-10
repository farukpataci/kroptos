import { ISageClient } from './sage.client';
import {
  SageBusiness,
  SageContact,
  SageContactCreatePayload,
  SageLedgerAccount,
  SageSalesInvoice,
  SageSalesInvoiceCreatePayload,
  SageTaxRate,
} from './sage.types';

import businessesFixture from './__fixtures__/businesses.fixture.json';
import contactsFixture from './__fixtures__/contacts.fixture.json';
import ledgerAccountsFixture from './__fixtures__/ledger-accounts.fixture.json';
import salesInvoiceFixture from './__fixtures__/sales-invoice.fixture.json';
import taxRatesFixture from './__fixtures__/tax-rates.fixture.json';

export class SageMockClient implements ISageClient {
  private invoices = new Map<string, SageSalesInvoice>();
  private contacts = new Map<string, SageContact>();
  private invoiceCounter = 1000;

  constructor(private readonly credentials: Record<string, any> = {}) {
    // Seed with fixture
    const defaultInv = salesInvoiceFixture as unknown as SageSalesInvoice;
    this.invoices.set(defaultInv.id, defaultInv);
    if (defaultInv.reference) {
      this.invoices.set(`ref_${defaultInv.reference}`, defaultInv);
    }

    const defaultContacts = contactsFixture.$items as unknown as SageContact[];
    for (const c of defaultContacts) {
      this.contacts.set(c.id, c);
      if (c.reference) {
        this.contacts.set(`ref_${c.reference}`, c);
      }
    }
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    companyName?: string;
    companyId?: string;
  }> {
    const businessId = this.credentials.businessId || 'biz-sage-uk-01';
    const businesses = await this.listBusinesses();
    const found = businesses.find((b) => b.id === businessId);

    return {
      success: true,
      message: 'Sage Business Cloud Accounting mock bağlantısı başarılı.',
      companyName: found ? found.name : 'KroptOS UK Ltd',
      companyId: businessId,
    };
  }

  async createSalesInvoice(
    payload: SageSalesInvoiceCreatePayload,
  ): Promise<SageSalesInvoice> {
    this.invoiceCounter++;
    const id = `inv-sage-${this.invoiceCounter}`;
    const invoiceNumber = `SI-${this.invoiceCounter}`;

    const lines = payload.sales_invoice.invoice_lines.map((l, idx) => {
      const net = l.quantity * l.unit_price - (l.discount_amount || 0);
      // Mock standard 20% tax calculation
      const tax = net * 0.2;
      return {
        id: `line-sage-${idx + 1}`,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        net_amount: net,
        tax_amount: tax,
        total_amount: net + tax,
        tax_rate: {
          id: l.tax_rate_id,
          displayed_as: 'Standard 20%',
        },
        ledger_account: {
          id: l.ledger_account_id,
          displayed_as: `Sales (${l.ledger_account_id})`,
        },
      };
    });

    const netAmount = lines.reduce((sum, l) => sum + l.net_amount, 0);
    const taxAmount = lines.reduce((sum, l) => sum + l.tax_amount, 0);
    const totalAmount = netAmount + taxAmount;

    const invoice: SageSalesInvoice = {
      id,
      displayed_as: invoiceNumber,
      invoice_number: invoiceNumber,
      $path: `/sales_invoices/${id}`,
      date: payload.sales_invoice.date,
      due_date: payload.sales_invoice.due_date,
      reference: payload.sales_invoice.reference,
      status: {
        id: 'UNPAID',
        displayed_as: 'Unpaid',
      },
      net_amount: netAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      outstanding_amount: totalAmount,
      currency: {
        id: 'GBP',
        displayed_as: 'Pound Sterling',
      },
      invoice_lines: lines,
    };

    this.invoices.set(id, invoice);
    if (invoice.reference) {
      this.invoices.set(`ref_${invoice.reference}`, invoice);
    }

    return invoice;
  }

  async getSalesInvoice(id: string): Promise<SageSalesInvoice> {
    const inv = this.invoices.get(id);
    if (!inv) {
      throw new Error(`Sage invoice '${id}' not found`);
    }
    return inv;
  }

  async syncContact(payload: SageContactCreatePayload): Promise<SageContact> {
    const contactData = payload.contact;
    const refKey = contactData.reference ? `ref_${contactData.reference}` : null;

    if (refKey && this.contacts.has(refKey)) {
      return this.contacts.get(refKey)!;
    }

    const id = `contact-sage-${this.contacts.size + 100}`;
    const newContact: SageContact = {
      id,
      displayed_as: contactData.name,
      name: contactData.name,
      contact_type_ids: contactData.contact_type_ids,
      reference: contactData.reference,
      email: contactData.email,
      tax_number: contactData.tax_number,
    };

    this.contacts.set(id, newContact);
    if (refKey) {
      this.contacts.set(refKey, newContact);
    }

    return newContact;
  }

  async findInvoiceByReference(
    referenceCode: string,
  ): Promise<SageSalesInvoice | null> {
    return this.invoices.get(`ref_${referenceCode}`) || null;
  }

  async listBusinesses(): Promise<SageBusiness[]> {
    return businessesFixture.$items as unknown as SageBusiness[];
  }

  async listLedgerAccounts(): Promise<SageLedgerAccount[]> {
    return ledgerAccountsFixture.$items as unknown as SageLedgerAccount[];
  }

  async listTaxRates(): Promise<SageTaxRate[]> {
    return taxRatesFixture.$items as unknown as SageTaxRate[];
  }
}
