import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import {
  AccountingContactRequest,
  AccountingContactResult,
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
  AccountingPaymentRequest,
  AccountingPaymentResult,
  AccountingProductRequest,
  AccountingProductResult,
  AccountingTestConnectionResult,
} from '../core/AccountingTypes';
import { IParasutClient } from './parasut.client';

export class ParasutProductionClient implements IParasutClient {
  constructor(private readonly credentials: Record<string, any>) {}

  async testConnection(): Promise<AccountingTestConnectionResult> {
    throw new IntegrationNotVerifiedError('PARASUT', 'PRODUCTION');
  }

  async createInvoice(_request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    throw new IntegrationNotVerifiedError('PARASUT', 'PRODUCTION');
  }

  async recordPayment(_request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    throw new IntegrationNotVerifiedError('PARASUT', 'PRODUCTION');
  }

  async syncContact(_request: AccountingContactRequest): Promise<AccountingContactResult> {
    throw new IntegrationNotVerifiedError('PARASUT', 'PRODUCTION');
  }

  async mapProduct(_request: AccountingProductRequest): Promise<AccountingProductResult> {
    throw new IntegrationNotVerifiedError('PARASUT', 'PRODUCTION');
  }

  async findInvoiceByReference(_referenceCode: string): Promise<AccountingInvoiceResult | null> {
    throw new IntegrationNotVerifiedError('PARASUT', 'PRODUCTION');
  }
}
