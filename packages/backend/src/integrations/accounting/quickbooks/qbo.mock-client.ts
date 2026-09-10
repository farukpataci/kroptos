import { BaseQBOClient } from './qbo.client';
import {
  QBOCustomer,
  QBOInvoice,
  QBOItem,
  QBOPayment,
  QBOPreferences,
  QBOCompanyInfo,
  QBO_API_MINORVERSION,
} from './qbo.types';

export class QBOMockClient extends BaseQBOClient {
  public invoices: Map<string, QBOInvoice> = new Map();
  public customers: Map<string, QBOCustomer> = new Map();
  public items: Map<string, QBOItem> = new Map();
  public payments: Map<string, QBOPayment> = new Map();
  public requestIdCache: Map<string, QBOInvoice> = new Map();

  public preferences: QBOPreferences = {
    TaxPrefs: {
      UsingSalesTax: true,
      PartnerTaxEnabled: true, // AST enabled by default in mock
    },
    CurrencyPrefs: {
      MultiCurrencyEnabled: false,
      HomeCurrency: { value: 'USD' },
    },
  };

  public companyInfo: QBOCompanyInfo = {
    Id: 'mock-realm-1',
    CompanyName: 'KroptOS Global US Corp (Sandbox)',
    LegalName: 'KroptOS Global US Inc.',
    Country: 'US',
    FiscalYearStartMonth: 'January',
  };

  public simulatedCalls: Array<{
    url: string;
    method: string;
    params?: Record<string, string>;
  }> = [];

  constructor(realmId: string = 'mock-realm-1') {
    super(realmId);
  }

  async createInvoice(invoice: QBOInvoice, requestId?: string): Promise<QBOInvoice> {
    const url = this.buildUrl('invoice', requestId ? { requestid: requestId } : undefined);
    this.simulatedCalls.push({ url, method: 'POST', params: { minorversion: QBO_API_MINORVERSION, ...(requestId ? { requestid: requestId } : {}) } });

    // Native idempotency check
    if (requestId && this.requestIdCache.has(requestId)) {
      return this.requestIdCache.get(requestId)!;
    }

    const id = invoice.Id || `qbo-inv-${this.invoices.size + 1}`;
    const syncToken = invoice.SyncToken || '0';

    // Calculate lines total
    const linesTotal = (invoice.Line || []).reduce((sum, line) => sum + (line.Amount || 0), 0);
    const taxTotal = invoice.TxnTaxDetail?.TotalTax || 0;
    const totalAmt = +(linesTotal + taxTotal).toFixed(2);

    const saved: QBOInvoice = {
      ...invoice,
      Id: id,
      SyncToken: syncToken,
      TotalAmt: totalAmt,
      Balance: totalAmt,
      MetaData: {
        CreateTime: new Date().toISOString(),
        LastUpdatedTime: new Date().toISOString(),
      },
    };

    this.invoices.set(id, saved);
    if (requestId) {
      this.requestIdCache.set(requestId, saved);
    }
    return saved;
  }

  async getInvoice(id: string): Promise<QBOInvoice> {
    const url = this.buildUrl(`invoice/${id}`);
    this.simulatedCalls.push({ url, method: 'GET', params: { minorversion: QBO_API_MINORVERSION } });

    const inv = this.invoices.get(id);
    if (!inv) {
      const err: any = new Error(`Object Not Found: Invoice ${id}`);
      err.code = '610';
      throw err;
    }
    return { ...inv };
  }

  async findInvoiceByDocNumber(docNumber: string): Promise<QBOInvoice | null> {
    const url = this.buildUrl('query', { query: `select * from Invoice where DocNumber = '${docNumber}'` });
    this.simulatedCalls.push({ url, method: 'GET' });

    for (const inv of this.invoices.values()) {
      if (inv.DocNumber === docNumber) {
        return { ...inv };
      }
    }
    return null;
  }

  async voidInvoice(id: string, syncToken: string): Promise<QBOInvoice> {
    const url = this.buildUrl('invoice', { operation: 'void' });
    this.simulatedCalls.push({ url, method: 'POST', params: { operation: 'void', minorversion: QBO_API_MINORVERSION } });

    const inv = await this.getInvoice(id);
    if (inv.SyncToken !== syncToken) {
      const err: any = new Error('Stale Object Error');
      err.code = '5010';
      throw err;
    }

    const nextSyncToken = String(Number(inv.SyncToken || '0') + 1);
    inv.SyncToken = nextSyncToken;
    inv.TotalAmt = 0;
    inv.Balance = 0;
    inv.PrivateNote = `${inv.PrivateNote || ''} [Voided]`.trim();

    this.invoices.set(id, inv);
    return { ...inv };
  }

  async deleteInvoice(id: string, syncToken: string): Promise<{ status: string }> {
    const url = this.buildUrl('invoice', { operation: 'delete' });
    this.simulatedCalls.push({ url, method: 'POST', params: { operation: 'delete', minorversion: QBO_API_MINORVERSION } });

    const inv = await this.getInvoice(id);
    if (inv.SyncToken !== syncToken) {
      const err: any = new Error('Stale Object Error');
      err.code = '5010';
      throw err;
    }

    this.invoices.delete(id);
    return { status: 'Deleted' };
  }

  async createCustomer(customer: QBOCustomer): Promise<QBOCustomer> {
    const url = this.buildUrl('customer');
    this.simulatedCalls.push({ url, method: 'POST' });

    const id = customer.Id || `qbo-cust-${this.customers.size + 1}`;
    const saved: QBOCustomer = {
      ...customer,
      Id: id,
      SyncToken: '0',
    };
    this.customers.set(id, saved);
    return saved;
  }

  async findCustomer(search: string): Promise<QBOCustomer | null> {
    const clean = search.toLowerCase();
    for (const cust of this.customers.values()) {
      if (
        cust.DisplayName.toLowerCase().includes(clean) ||
        cust.PrimaryEmailAddr?.Address?.toLowerCase() === clean ||
        cust.TaxIdentifier === search
      ) {
        return { ...cust };
      }
    }
    return null;
  }

  async createPayment(payment: QBOPayment): Promise<QBOPayment> {
    const url = this.buildUrl('payment');
    this.simulatedCalls.push({ url, method: 'POST' });

    const id = payment.Id || `qbo-pay-${this.payments.size + 1}`;
    const saved: QBOPayment = {
      ...payment,
      Id: id,
      SyncToken: '0',
    };

    // Update linked invoices balances
    if (payment.Line) {
      for (const line of payment.Line) {
        if (line.LinkedTxn) {
          for (const link of line.LinkedTxn) {
            const inv = this.invoices.get(link.TxnId);
            if (inv && inv.Balance !== undefined) {
              inv.Balance = Math.max(0, +(inv.Balance - line.Amount).toFixed(2));
              inv.SyncToken = String(Number(inv.SyncToken || '0') + 1);
            }
          }
        }
      }
    }

    this.payments.set(id, saved);
    return saved;
  }

  async createItem(item: QBOItem): Promise<QBOItem> {
    const url = this.buildUrl('item');
    this.simulatedCalls.push({ url, method: 'POST' });

    const id = item.Id || `qbo-item-${this.items.size + 1}`;
    const saved: QBOItem = {
      ...item,
      Id: id,
      SyncToken: '0',
    };
    this.items.set(id, saved);
    return saved;
  }

  async getPreferences(): Promise<QBOPreferences> {
    const url = this.buildUrl('preferences');
    this.simulatedCalls.push({ url, method: 'GET' });
    return JSON.parse(JSON.stringify(this.preferences));
  }

  async getCompanyInfo(): Promise<QBOCompanyInfo> {
    const url = this.buildUrl(`companyinfo/${this.realmId}`);
    this.simulatedCalls.push({ url, method: 'GET' });
    return JSON.parse(JSON.stringify(this.companyInfo));
  }
}
