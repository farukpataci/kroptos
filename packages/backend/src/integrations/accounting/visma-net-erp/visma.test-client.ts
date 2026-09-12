import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { IVismaClient, VISMA_BASE_URL } from './visma.client';
import {
  VismaBackgroundJobResponse,
  VismaCustomerDto,
  VismaCustomerInvoiceDto,
  VismaPaymentDto,
  VismaRateLimitInfo,
} from './visma.types';

export class VismaTestClient implements IVismaClient {
  readonly companyId: string;
  readonly baseUrl: string;

  constructor(companyId = '', baseUrl = VISMA_BASE_URL) {
    this.companyId = companyId;
    this.baseUrl = baseUrl;
  }

  getRateLimitInfo(): VismaRateLimitInfo {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
  updateRateLimitFromHeaders(): void {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
  async findInvoiceByReference(): Promise<VismaCustomerInvoiceDto | null> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
  async createCustomerInvoiceBackground(): Promise<VismaBackgroundJobResponse> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
  async pollBackgroundJob(): Promise<VismaBackgroundJobResponse> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
  async fetchBackgroundContent<T>(): Promise<T> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
  async getInvoice(): Promise<VismaCustomerInvoiceDto> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
  async releaseInvoice(): Promise<{ success: boolean; invoiceNumber: string }> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
  async syncCustomer(): Promise<{ internalId: number; customerNumber: string }> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
  async recordPayment(): Promise<{ paymentNumber: string }> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
  async cancelInvoice(): Promise<{ cancellationType: 'voided' | 'credit_note'; message: string }> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'TEST');
  }
}
