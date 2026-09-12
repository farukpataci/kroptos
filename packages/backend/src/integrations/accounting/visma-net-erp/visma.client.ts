/**
 * Visma.net ERP Client Interface & Rate Limit Tracker (§4.2, §5.3, §5.7)
 *
 * Enforces:
 * 1. Base URL: https://api.finance.visma.net
 * 2. Header `ipp-company-id`: Derived ONLY from credentials, never from request payload (§5.3)
 * 3. Dynamic header learning: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset (seconds)
 */

import {
  VismaBackgroundJobResponse,
  VismaCustomerDto,
  VismaCustomerInvoiceDto,
  VismaPaymentDto,
  VismaRateLimitInfo,
} from './visma.types';

export const VISMA_BASE_URL = 'https://api.finance.visma.net';
export const VISMA_COMPANY_HEADER = 'ipp-company-id';

export interface IVismaClient {
  readonly companyId: string;
  readonly baseUrl: string;

  getRateLimitInfo(): VismaRateLimitInfo;
  updateRateLimitFromHeaders(headers: Record<string, string | number | undefined>): void;

  findInvoiceByReference(referenceCode: string): Promise<VismaCustomerInvoiceDto | null>;
  createCustomerInvoiceBackground(invoice: VismaCustomerInvoiceDto): Promise<VismaBackgroundJobResponse>;
  pollBackgroundJob(jobId: string, stateLocation: string): Promise<VismaBackgroundJobResponse>;
  fetchBackgroundContent<T>(contentLocation: string): Promise<T>;
  getInvoice(invoiceNumber: string): Promise<VismaCustomerInvoiceDto>;
  releaseInvoice(invoiceNumber: string): Promise<{ success: boolean; invoiceNumber: string }>;
  syncCustomer(customer: VismaCustomerDto): Promise<{ internalId: number; customerNumber: string }>;
  recordPayment(payment: VismaPaymentDto): Promise<{ paymentNumber: string }>;
  cancelInvoice(invoiceNumber: string): Promise<{ cancellationType: 'voided' | 'credit_note'; message: string }>;
}

export class VismaRateLimitTracker {
  private currentInfo: VismaRateLimitInfo = {
    lastUpdated: Date.now(),
  };

  getInfo(): VismaRateLimitInfo {
    return { ...this.currentInfo };
  }

  updateFromHeaders(headers: Record<string, string | number | undefined>): void {
    if (!headers) return;

    const findHeader = (name: string): string | undefined => {
      const lower = name.toLowerCase();
      for (const [key, val] of Object.entries(headers)) {
        if (key.toLowerCase() === lower && val !== undefined) {
          return String(val);
        }
      }
      return undefined;
    };

    const limitStr = findHeader('x-ratelimit-limit');
    const remainingStr = findHeader('x-ratelimit-remaining');
    const resetStr = findHeader('x-ratelimit-reset');
    const policyStr = findHeader('x-ratelimit-policy');

    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const remaining = remainingStr ? parseInt(remainingStr, 10) : undefined;
    const resetSeconds = resetStr ? parseInt(resetStr, 10) : undefined;

    this.currentInfo = {
      limit: Number.isFinite(limit) ? limit : this.currentInfo.limit,
      remaining: Number.isFinite(remaining) ? remaining : this.currentInfo.remaining,
      resetSeconds: Number.isFinite(resetSeconds) ? resetSeconds : this.currentInfo.resetSeconds,
      policy: policyStr || this.currentInfo.policy,
      lastUpdated: Date.now(),
    };
  }
}
