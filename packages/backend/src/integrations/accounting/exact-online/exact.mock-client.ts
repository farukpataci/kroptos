import { ExactBudgetManager } from './exact.budget';
import { ExactPaginationParams, IExactClient } from './exact.client';
import {
  ExactAccount,
  ExactDivision,
  ExactItem,
  ExactMeResponse,
  ExactODataResponse,
  ExactSalesInvoice,
  ExactSalesInvoiceLine,
  ExactVATCode,
} from './exact.types';

export class ExactMockClient implements IExactClient {
  private accounts = new Map<string, ExactAccount>();
  private items = new Map<string, ExactItem>();
  private invoices = new Map<string, ExactSalesInvoice>();
  private deletedLog: Array<{ id: string; entityType: string; timestamp: number }> = [];

  private currentDivision = 100001;

  constructor(private readonly budgetManager: ExactBudgetManager = ExactBudgetManager.getInstance()) {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    // Örnek varsayılan hesap (Customer)
    const mockCustomer: ExactAccount = {
      ID: 'a0000000-0000-0000-0000-000000000001',
      Code: 'CUST-001',
      Name: 'KroptOS Benelux B.V.',
      IsCustomer: true,
      IsSupplier: false,
      Email: 'finance@kroptos-benelux.nl',
      Phone: '+31 20 123 4567',
      AddressLine1: 'Keizersgracht 100',
      Postcode: '1015 AA',
      City: 'Amsterdam',
      Country: 'NL',
      VATNumber: 'NL123456789B01',
      Status: 'C',
    };
    this.accounts.set(mockCustomer.ID, mockCustomer);

    // Örnek varsayılan ürün
    const mockItem: ExactItem = {
      ID: 'b0000000-0000-0000-0000-000000000001',
      Code: 'ITEM-DEFAULT',
      Description: 'KroptOS Standart Hizmet / Ürün',
      CostPriceNew: 10.0,
      IsSalesItem: true,
      IsStockItem: false,
    };
    this.items.set(mockItem.ID, mockItem);
  }

  /**
   * Mock HTTP çağrısını simüle eder ve bütçe yöneticisine kota header'larını iletir.
   */
  private recordMockCall(division: number | string) {
    const currentState = this.budgetManager.getBudgetState(division);
    const newMinRemaining = Math.max(0, currentState.minutelyRemaining - 1);
    const newDayRemaining = Math.max(0, currentState.dailyRemaining - 1);

    this.budgetManager.updateFromHeaders(division, {
      'X-RateLimit-Minutely-Limit': currentState.minutelyLimit,
      'X-RateLimit-Minutely-Remaining': newMinRemaining,
      'X-RateLimit-Limit': currentState.dailyLimit,
      'X-RateLimit-Remaining': newDayRemaining,
      'X-RateLimit-Reset': currentState.resetEpochMs,
    });
  }

  async getMe(): Promise<ExactMeResponse> {
    this.recordMockCall(this.currentDivision);
    return {
      CurrentDivision: this.currentDivision,
      DivisionCustomer: 'KroptOS Demo Holding B.V.',
      FullName: 'KroptOS Operasyon Yöneticisi',
      UserID: 'u0000000-0000-0000-0000-000000000001',
      UserName: 'admin@kroptos.com',
      Email: 'admin@kroptos.com',
    };
  }

  async listDivisions(): Promise<ExactDivision[]> {
    this.recordMockCall(this.currentDivision);
    return [
      {
        Code: this.currentDivision,
        Description: 'KroptOS Ana Bölüm (NL)',
        HID: this.currentDivision,
        Customer: 'c0000000-0000-0000-0000-000000000001',
        CustomerName: 'KroptOS Demo Holding B.V.',
        Status: 1,
        Currency: 'EUR',
        Country: 'NL',
      },
      {
        Code: 100002,
        Description: 'KroptOS Belçika Şubesi (BE)',
        HID: 100002,
        Customer: 'c0000000-0000-0000-0000-000000000002',
        CustomerName: 'KroptOS Belgium SPRL',
        Status: 1,
        Currency: 'EUR',
        Country: 'BE',
      },
    ];
  }

  async getDivision(code: number | string): Promise<ExactDivision> {
    this.recordMockCall(code);
    const divisions = await this.listDivisions();
    const found = divisions.find((d) => d.Code === Number(code));
    if (!found) {
      throw new Error(`[Exact Mock] Bölüm bulunamadı (Division: ${code})`);
    }
    return found;
  }

  async listAccounts(
    division: number | string,
    params?: ExactPaginationParams,
  ): Promise<ExactODataResponse<ExactAccount>> {
    this.recordMockCall(division);
    const all = Array.from(this.accounts.values());
    return {
      d: {
        results: all,
      },
    };
  }

  async getAccount(division: number | string, id: string): Promise<ExactAccount> {
    this.recordMockCall(division);
    const acc = this.accounts.get(id);
    if (!acc) {
      throw new Error(`[Exact Mock] Cari hesap bulunamadı (ID: ${id})`);
    }
    return acc;
  }

  async createAccount(
    division: number | string,
    account: Partial<ExactAccount>,
  ): Promise<ExactAccount> {
    this.recordMockCall(division);
    const id = account.ID || `a0000000-0000-0000-0000-${Date.now().toString(16).padStart(12, '0')}`;
    const full: ExactAccount = {
      ID: id,
      Code: account.Code || `CUST-${this.accounts.size + 1}`,
      Name: account.Name || 'Yeni Müşteri',
      IsCustomer: account.IsCustomer ?? true,
      IsSupplier: account.IsSupplier ?? false,
      Email: account.Email,
      Phone: account.Phone,
      AddressLine1: account.AddressLine1,
      City: account.City,
      Country: account.Country || 'NL',
      VATNumber: account.VATNumber,
      Status: 'C',
    };
    this.accounts.set(id, full);
    return full;
  }

  async listItems(
    division: number | string,
    params?: ExactPaginationParams,
  ): Promise<ExactODataResponse<ExactItem>> {
    this.recordMockCall(division);
    return {
      d: {
        results: Array.from(this.items.values()),
      },
    };
  }

  async listVATCodes(division: number | string): Promise<ExactVATCode[]> {
    this.recordMockCall(division);
    return [
      { Code: '2', Description: 'Hoog 21%', Percentage: 21, Type: 'I' },
      { Code: '1', Description: 'Laag 9%', Percentage: 9, Type: 'I' },
      { Code: '0', Description: 'Nul 0%', Percentage: 0, Type: 'I' },
      { Code: '20', Description: 'UK Standard 20%', Percentage: 20, Type: 'I' },
    ];
  }

  async createSalesInvoice(
    division: number | string,
    invoice: Partial<ExactSalesInvoice>,
  ): Promise<ExactSalesInvoice> {
    this.recordMockCall(division);
    const id = invoice.InvoiceID || `inv-guid-${Date.now().toString(16).padStart(12, '0')}`;
    const invoiceNum = this.invoices.size + 1001;

    // Sunucu tarafı tutar hesaplama simülasyonu (§5.6)
    let totalNet = 0;
    let totalVAT = 0;

    const processedLines: ExactSalesInvoiceLine[] = (invoice.SalesInvoiceLines || []).map(
      (line, idx) => {
        const lineNet = line.Quantity * line.UnitPrice;
        const rate = line.VATPercentage || (line.VATCode === '2' ? 21 : line.VATCode === '1' ? 9 : 0);
        const lineVAT = (lineNet * rate) / 100;
        totalNet += lineNet;
        totalVAT += lineVAT;

        return {
          ...line,
          ID: `line-${id}-${idx + 1}`,
          LineNumber: idx + 1,
          AmountDC: lineNet,
          VATAmount: lineVAT,
        };
      },
    );

    const totalGross = totalNet + totalVAT;

    const fullInvoice: ExactSalesInvoice = {
      InvoiceID: id,
      InvoiceNumber: invoiceNum,
      InvoiceDate: invoice.InvoiceDate || new Date().toISOString().slice(0, 10),
      DueDate: invoice.DueDate,
      OrderedBy: invoice.OrderedBy || '',
      DeliverTo: invoice.DeliverTo,
      YourRef: invoice.YourRef,
      Description: invoice.Description,
      Currency: invoice.Currency || 'EUR',
      Status: 20, // Open (§6)
      Type: 8020, // Sales invoice
      AmountDC: Math.round(totalGross * 100) / 100,
      AmountFC: Math.round(totalGross * 100) / 100,
      VATAmountDC: Math.round(totalVAT * 100) / 100,
      SalesInvoiceLines: processedLines,
    };

    this.invoices.set(id, fullInvoice);
    return fullInvoice;
  }

  async getSalesInvoice(division: number | string, id: string): Promise<ExactSalesInvoice> {
    this.recordMockCall(division);
    const invoice = this.invoices.get(id);
    if (!invoice) {
      throw new Error(`[Exact Mock] Satış faturası bulunamadı (ID: ${id})`);
    }
    return invoice;
  }

  async findSalesInvoiceByReference(
    division: number | string,
    reference: string,
  ): Promise<ExactSalesInvoice | null> {
    this.recordMockCall(division);
    const targetRef = reference.trim().toLowerCase();
    for (const inv of this.invoices.values()) {
      if (inv.YourRef?.trim().toLowerCase() === targetRef) {
        return inv;
      }
    }
    return null;
  }

  async cancelSalesInvoice(
    division: number | string,
    id: string,
  ): Promise<ExactSalesInvoice> {
    this.recordMockCall(division);
    const invoice = this.invoices.get(id);
    if (!invoice) {
      throw new Error(`[Exact Mock] Fatura bulunamadı (ID: ${id})`);
    }

    if (invoice.Status === 50) {
      throw new Error(
        'İşlenmiş (Processed - 50) Exact Online satış faturası doğrudan iptal edilemez.',
      );
    }

    this.invoices.delete(id);
    this.deletedLog.push({ id, entityType: 'SalesInvoices', timestamp: Date.now() });

    return {
      ...invoice,
      Status: 20,
      Description: `[İPTAL EDİLDİ] ${invoice.Description || ''}`,
    };
  }

  async getSyncDeleted(
    division: number | string,
    entityType: string,
    timestamp?: number,
  ): Promise<any[]> {
    this.recordMockCall(division);
    return this.deletedLog.filter(
      (entry) =>
        entry.entityType === entityType &&
        (!timestamp || entry.timestamp >= timestamp),
    );
  }
}
