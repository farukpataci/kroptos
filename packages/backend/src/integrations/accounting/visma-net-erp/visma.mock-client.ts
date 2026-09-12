/**
 * Visma.net ERP Mock Client (§2, §4, §8)
 *
 * Implements in-memory simulation of:
 * 1. Background operation engine (202 Accepted -> stateLocation -> contentLocation)
 * 2. Server-side amount and VAT calculations
 * 3. Customer invoice lifecycle (Balanced -> release -> Open, or cancel -> Voided/Credit Note)
 * 4. Rate limit headers and simulation
 * 5. Strictly ZERO live network calls
 */

import { IVismaClient, VISMA_BASE_URL, VismaRateLimitTracker } from './visma.client';
import {
  VismaBackgroundJobResponse,
  VismaCustomerDto,
  VismaCustomerInvoiceDto,
  VismaPaymentDto,
  VismaRateLimitInfo,
} from './visma.types';

export class VismaMockClient implements IVismaClient {
  readonly companyId: string;
  readonly baseUrl: string;

  private readonly invoices = new Map<string, VismaCustomerInvoiceDto>();
  private readonly customers = new Map<string, VismaCustomerDto>();
  private readonly payments = new Map<string, VismaPaymentDto>();
  private readonly backgroundJobs = new Map<
    string,
    {
      job: VismaBackgroundJobResponse;
      targetData: any;
      remainingPolls: number;
    }
  >();

  private readonly rateLimitTracker = new VismaRateLimitTracker();
  private invoiceCounter = 1000;
  private jobCounter = 100;

  constructor(companyId = '1113659', baseUrl = VISMA_BASE_URL) {
    this.companyId = companyId;
    this.baseUrl = baseUrl;

    this.rateLimitTracker.updateFromHeaders({
      'x-ratelimit-limit': 5000,
      'x-ratelimit-remaining': 4995,
      'x-ratelimit-reset': 3600,
      'x-ratelimit-policy': '4-fixed-window',
    });
  }

  getRateLimitInfo(): VismaRateLimitInfo {
    return this.rateLimitTracker.getInfo();
  }

  updateRateLimitFromHeaders(headers: Record<string, string | number | undefined>): void {
    this.rateLimitTracker.updateFromHeaders(headers);
  }

  async findInvoiceByReference(referenceCode: string): Promise<VismaCustomerInvoiceDto | null> {
    for (const inv of this.invoices.values()) {
      if (inv.customerRefNo?.value === referenceCode) {
        return { ...inv };
      }
    }
    return null;
  }

  async createCustomerInvoiceBackground(
    invoice: VismaCustomerInvoiceDto,
  ): Promise<VismaBackgroundJobResponse> {
    this.invoiceCounter++;
    const invNumber = `INV-${this.invoiceCounter}`;

    // Simulate server-side total and VAT calculation (§5.4)
    let netTotal = 0;
    let vatTotal = 0;

    for (const line of invoice.invoiceLines || []) {
      const qty = Number(line.quantity?.value || 1);
      const price = Number(line.unitPriceInCurrency?.value || 0);
      const lineNet = qty * price;
      const vatCode = line.vatCodeId?.value || '25';
      const vatRate = vatCode === '25' ? 0.25 : vatCode === '15' ? 0.15 : 0;
      const lineVat = lineNet * vatRate;

      netTotal += lineNet;
      vatTotal += lineVat;
    }

    const calculatedTotal = Number((netTotal + vatTotal).toFixed(2));
    const calculatedVat = Number(vatTotal.toFixed(2));

    const savedInvoice: VismaCustomerInvoiceDto = {
      ...invoice,
      invoiceNumber: invNumber,
      referenceNumber: { value: invNumber },
      status: { value: 'Balanced' }, // Starts as draft/balanced
      amount: calculatedTotal,
      vatAmount: calculatedVat,
      timestamp: new Date().toISOString(),
    };

    this.invoices.set(invNumber, savedInvoice);

    // Create background job response
    this.jobCounter++;
    const jobId = `job-${this.jobCounter}-${Date.now()}`;
    const stateLocation = `/api/v1/background/${jobId}`;
    const contentLocation = `/api/v1/background/${jobId}/content`;

    const jobResponse: VismaBackgroundJobResponse = {
      jobId,
      stateLocation,
      contentLocation,
      status: 'Queued',
      createdTime: new Date().toISOString(),
    };

    this.backgroundJobs.set(jobId, {
      job: jobResponse,
      targetData: savedInvoice,
      remainingPolls: 1, // Becomes completed after 1 poll
    });

    return jobResponse;
  }

  async pollBackgroundJob(jobId: string, _stateLocation: string): Promise<VismaBackgroundJobResponse> {
    const record = this.backgroundJobs.get(jobId);
    if (!record) {
      throw new Error(`Visma arka plan işi bulunamadı: ${jobId}`);
    }

    if (record.remainingPolls > 0) {
      record.remainingPolls--;
      return {
        ...record.job,
        status: 'Running',
      };
    }

    record.job.status = 'Completed';
    return {
      ...record.job,
      status: 'Completed',
    };
  }

  async fetchBackgroundContent<T>(contentLocation: string): Promise<T> {
    for (const record of this.backgroundJobs.values()) {
      if (record.job.contentLocation === contentLocation) {
        return record.targetData as T;
      }
    }
    throw new Error(`Visma arka plan içeriği bulunamadı: ${contentLocation}`);
  }

  async getInvoice(invoiceNumber: string): Promise<VismaCustomerInvoiceDto> {
    const inv = this.invoices.get(invoiceNumber);
    if (!inv) {
      throw new Error(`Visma faturası bulunamadı: ${invoiceNumber}`);
    }
    return { ...inv };
  }

  async releaseInvoice(invoiceNumber: string): Promise<{ success: boolean; invoiceNumber: string }> {
    const inv = this.invoices.get(invoiceNumber);
    if (!inv) {
      throw new Error(`Visma faturası bulunamadı: ${invoiceNumber}`);
    }

    inv.status = { value: 'Open' };
    this.invoices.set(invoiceNumber, inv);
    return { success: true, invoiceNumber };
  }

  async syncCustomer(customer: VismaCustomerDto): Promise<{ internalId: number; customerNumber: string }> {
    const custNumber = customer.number?.value || `CUST-${this.customers.size + 1000}`;
    const internalId = (customer.internalId || this.customers.size) + 1;

    const saved: VismaCustomerDto = {
      ...customer,
      internalId,
      number: { value: custNumber },
      status: { value: 'Active' },
    };

    this.customers.set(custNumber, saved);
    return { internalId, customerNumber: custNumber };
  }

  async recordPayment(payment: VismaPaymentDto): Promise<{ paymentNumber: string }> {
    const pmtNumber = `PMT-${this.payments.size + 1001}`;
    this.payments.set(pmtNumber, {
      ...payment,
      paymentNumber: pmtNumber,
      status: { value: 'Open' },
    });
    return { paymentNumber: pmtNumber };
  }

  async cancelInvoice(
    invoiceNumber: string,
  ): Promise<{ cancellationType: 'voided' | 'credit_note'; message: string }> {
    const inv = this.invoices.get(invoiceNumber);
    if (!inv) {
      throw new Error(`Visma faturası bulunamadı: ${invoiceNumber}`);
    }

    const currentStatus =
      typeof inv.status === 'object' && 'value' in inv.status
        ? inv.status.value
        : String(inv.status);

    if (currentStatus === 'Balanced' || currentStatus === 'Hold') {
      inv.status = { value: 'Voided' };
      this.invoices.set(invoiceNumber, inv);
      return { cancellationType: 'voided', message: `Taslak fatura (${invoiceNumber}) doğrudan iptal edildi.` };
    }

    inv.status = { value: 'Closed' };
    this.invoices.set(invoiceNumber, inv);
    return {
      cancellationType: 'credit_note',
      message: `Açık fatura (${invoiceNumber}) için ters kayıt (credit note) belgesi oluşturuldu.`,
    };
  }
}
