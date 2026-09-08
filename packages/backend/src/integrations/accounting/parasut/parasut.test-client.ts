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

export class ParasutTestClient implements IParasutClient {
  constructor(private readonly credentials: Record<string, any>) {}

  async testConnection(): Promise<AccountingTestConnectionResult> {
    throw new IntegrationNotVerifiedError('PARASUT', 'TEST');
  }

  async createInvoice(_request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    throw new IntegrationNotVerifiedError('PARASUT', 'TEST');
  }

  async recordPayment(_request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    throw new IntegrationNotVerifiedError('PARASUT', 'TEST');
  }

  async syncContact(_request: AccountingContactRequest): Promise<AccountingContactResult> {
    throw new IntegrationNotVerifiedError('PARASUT', 'TEST');
  }

  async mapProduct(_request: AccountingProductRequest): Promise<AccountingProductResult> {
    throw new IntegrationNotVerifiedError('PARASUT', 'TEST');
  }

  async findInvoiceByReference(_referenceCode: string): Promise<AccountingInvoiceResult | null> {
    throw new IntegrationNotVerifiedError('PARASUT', 'TEST');
  }
}
