import { HttpStatus } from '@nestjs/common';
import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitExceededError,
} from '../core/AccountingErrors';
import { IFortnoxClient } from './fortnox.client';
import {
  FortnoxArticle,
  FortnoxCustomer,
  FortnoxFinancialYear,
  FortnoxInvoice,
  FortnoxPayment,
} from './fortnox.types';
import { FortnoxWindowLimiter } from './fortnox.window-limiter';

export class FortnoxMockClient implements IFortnoxClient {
  private invoiceCounter = 1000;
  private readonly invoices = new Map<string, FortnoxInvoice>();
  private readonly customers = new Map<string, FortnoxCustomer>();
  private readonly articles = new Map<string, FortnoxArticle>();
  private readonly payments = new Map<string, FortnoxPayment>();

  public readonly limiter: FortnoxWindowLimiter;

  // Test simulation flags
  public simulateRateLimit = false;
  public simulateFinancialYearMissing = false;
  public simulateAmountMismatchDiff = 0;
  public simulateAuthError = false;

  private financialYears: FortnoxFinancialYear[] = [
    {
      Id: 1,
      FromDate: '2025-01-01',
      ToDate: '2025-12-31',
      AccountingMethod: 'ACCRUAL',
      Closed: false,
    },
    {
      Id: 2,
      FromDate: '2026-01-01',
      ToDate: '2026-12-31',
      AccountingMethod: 'ACCRUAL',
      Closed: false,
    },
    {
      Id: 3,
      FromDate: '2024-01-01',
      ToDate: '2024-12-31',
      AccountingMethod: 'ACCRUAL',
      Closed: true, // Closed year
    },
  ];

  constructor(limiter?: FortnoxWindowLimiter) {
    this.limiter = limiter ?? new FortnoxWindowLimiter();
  }

  private async checkThrottlingAndAuth(): Promise<void> {
    if (this.simulateAuthError) {
      throw new AccountingAuthError('fortnox', 'Unauthorized access token');
    }
    if (this.simulateRateLimit) {
      throw new AccountingRateLimitExceededError('fortnox', 5);
    }
    await this.limiter.acquire();
  }

  async getCompanyInformation(): Promise<{
    CompanyName: string;
    OrganisationNumber?: string;
    DatabaseNumber?: string | number;
  }> {
    await this.checkThrottlingAndAuth();
    return {
      CompanyName: 'KroptOS Testbolag AB (Mock)',
      OrganisationNumber: '556000-0000',
      DatabaseNumber: 1234567,
    };
  }

  async getFinancialYears(date?: string): Promise<FortnoxFinancialYear[]> {
    await this.checkThrottlingAndAuth();
    if (this.simulateFinancialYearMissing) {
      return [];
    }

    if (!date) {
      return this.financialYears;
    }

    const d = date.slice(0, 10);
    return this.financialYears.filter((y) => {
      const from = y.FromDate.slice(0, 10);
      const to = y.ToDate.slice(0, 10);
      return d >= from && d <= to;
    });
  }

  async createInvoice(invoice: FortnoxInvoice): Promise<FortnoxInvoice> {
    await this.checkThrottlingAndAuth();

    this.invoiceCounter++;
    const docNumber = String(this.invoiceCounter);

    // Calculate server totals from rows (§5.9)
    let net = 0;
    let totalVAT = 0;

    for (const row of invoice.InvoiceRows || []) {
      const rowNet = row.DeliveredQuantity * row.Price;
      const vatRate = (row.VAT ?? 25) / 100;
      const rowVAT = rowNet * vatRate;
      net += rowNet;
      totalVAT += rowVAT;
    }

    let gross = net + totalVAT;
    if (this.simulateAmountMismatchDiff !== 0) {
      gross += this.simulateAmountMismatchDiff;
    }

    const storedInvoice: FortnoxInvoice = {
      ...invoice,
      DocumentNumber: docNumber,
      Net: Number(net.toFixed(2)),
      TotalVAT: Number(totalVAT.toFixed(2)),
      Gross: Number(gross.toFixed(2)),
      Total: Number(gross.toFixed(2)),
      Booked: false, // Invoices start unbooked (§5.4)
      Cancelled: false,
      Currency: invoice.Currency || 'SEK',
    };

    this.invoices.set(docNumber, storedInvoice);
    return storedInvoice;
  }

  async getInvoice(documentNumber: string | number): Promise<FortnoxInvoice> {
    await this.checkThrottlingAndAuth();
    const inv = this.invoices.get(String(documentNumber));
    if (!inv) {
      throw new AccountingApiError(
        'fortnox',
        HttpStatus.NOT_FOUND,
        `Fortnox invoice #${documentNumber} not found`,
        { documentNumber },
      );
    }
    return inv;
  }

  async bookkeepInvoice(documentNumber: string | number): Promise<FortnoxInvoice> {
    await this.checkThrottlingAndAuth();
    const inv = await this.getInvoice(documentNumber);

    if (inv.Cancelled) {
      throw new AccountingApiError(
        'fortnox',
        HttpStatus.BAD_REQUEST,
        `Cannot bookkeep cancelled invoice #${documentNumber}`,
      );
    }

    inv.Booked = true;
    inv.Sent = true;
    this.invoices.set(String(documentNumber), inv);
    return inv;
  }

  async cancelInvoice(documentNumber: string | number): Promise<FortnoxInvoice> {
    await this.checkThrottlingAndAuth();
    const inv = await this.getInvoice(documentNumber);

    // Swedish Bokföringslagen: booked invoice cannot be cancelled directly (§5.5)
    if (inv.Booked) {
      throw new AccountingApiError(
        'fortnox',
        HttpStatus.BAD_REQUEST,
        `Kaydedilmiş (Booked: true) fatura doğrudan iptal edilemez. İsveç mevzuatı gereği düzeltme alacak faturası (credit invoice) ile yapılmalıdır.`,
      );
    }

    inv.Cancelled = true;
    this.invoices.set(String(documentNumber), inv);
    return inv;
  }

  async creditInvoice(documentNumber: string | number): Promise<FortnoxInvoice> {
    await this.checkThrottlingAndAuth();
    const original = await this.getInvoice(documentNumber);

    this.invoiceCounter++;
    const creditDocNumber = String(this.invoiceCounter);

    const creditInvoice: FortnoxInvoice = {
      ...original,
      DocumentNumber: creditDocNumber,
      Credit: original.DocumentNumber,
      Total: -Math.abs(original.Total ?? 0),
      TotalVAT: -Math.abs(original.TotalVAT ?? 0),
      Net: -Math.abs(original.Net ?? 0),
      Gross: -Math.abs(original.Gross ?? 0),
      Booked: true,
      Cancelled: false,
    };

    this.invoices.set(creditDocNumber, creditInvoice);
    return creditInvoice;
  }

  async searchInvoicesByOrderNumber(orderNumber: string): Promise<FortnoxInvoice[]> {
    await this.checkThrottlingAndAuth();
    const results: FortnoxInvoice[] = [];
    for (const inv of this.invoices.values()) {
      if (inv.YourOrderNumber === orderNumber) {
        results.push(inv);
      }
    }
    return results;
  }

  async createCustomer(customer: FortnoxCustomer): Promise<FortnoxCustomer> {
    await this.checkThrottlingAndAuth();
    this.customers.set(customer.CustomerNumber, customer);
    return customer;
  }

  async getCustomer(customerNumber: string): Promise<FortnoxCustomer | null> {
    await this.checkThrottlingAndAuth();
    return this.customers.get(customerNumber) || null;
  }

  async createArticle(article: FortnoxArticle): Promise<FortnoxArticle> {
    await this.checkThrottlingAndAuth();
    this.articles.set(article.ArticleNumber, article);
    return article;
  }

  async getArticle(articleNumber: string): Promise<FortnoxArticle | null> {
    await this.checkThrottlingAndAuth();
    return this.articles.get(articleNumber) || null;
  }

  async createPayment(payment: FortnoxPayment): Promise<FortnoxPayment> {
    await this.checkThrottlingAndAuth();
    const pNumber = Math.floor(Math.random() * 100000);
    const stored: FortnoxPayment = {
      ...payment,
      Number: pNumber,
      Booked: true,
    };
    this.payments.set(String(pNumber), stored);
    return stored;
  }
}
