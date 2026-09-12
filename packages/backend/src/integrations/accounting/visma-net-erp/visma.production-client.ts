import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { IVismaClient, VISMA_BASE_URL } from './visma.client';
import {
  VismaBackgroundJobResponse,
  VismaCustomerDto,
  VismaCustomerInvoiceDto,
  VismaPaymentDto,
  VismaRateLimitInfo,
} from './visma.types';

export class VismaProductionClient implements IVismaClient {
  readonly companyId: string;
  readonly baseUrl: string;

  constructor(companyId = '', baseUrl = VISMA_BASE_URL) {
    this.companyId = companyId;
    this.baseUrl = baseUrl;
  }

  getRateLimitInfo(): VismaRateLimitInfo {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
  updateRateLimitFromHeaders(): void {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
  async findInvoiceByReference(): Promise<VismaCustomerInvoiceDto | null> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
  async createCustomerInvoiceBackground(): Promise<VismaBackgroundJobResponse> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
  async pollBackgroundJob(): Promise<VismaBackgroundJobResponse> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
  async fetchBackgroundContent<T>(): Promise<T> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
  async getInvoice(): Promise<VismaCustomerInvoiceDto> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
  async releaseInvoice(): Promise<{ success: boolean; invoiceNumber: string }> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
  async syncCustomer(): Promise<{ internalId: number; customerNumber: string }> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
  async recordPayment(): Promise<{ paymentNumber: string }> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
  async cancelInvoice(): Promise<{ cancellationType: 'voided' | 'credit_note'; message: string }> {
    throw new IntegrationNotVerifiedError('VISMA-NET-ERP', 'PRODUCTION');
  }
}
