import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
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

export class SageProductionClient implements ISageClient {
  constructor(private readonly credentials: Record<string, any> = {}) {}

  private assertVerified(): never {
    throw new IntegrationNotVerifiedError('sage-accounting', 'PRODUCTION');
  }

  async testConnection(): Promise<any> {
    this.assertVerified();
  }

  async createSalesInvoice(
    _payload: SageSalesInvoiceCreatePayload,
  ): Promise<SageSalesInvoice> {
    this.assertVerified();
  }

  async getSalesInvoice(_id: string): Promise<SageSalesInvoice> {
    this.assertVerified();
  }

  async syncContact(_payload: SageContactCreatePayload): Promise<SageContact> {
    this.assertVerified();
  }

  async findInvoiceByReference(
    _referenceCode: string,
  ): Promise<SageSalesInvoice | null> {
    this.assertVerified();
  }

  async listBusinesses(): Promise<SageBusiness[]> {
    this.assertVerified();
  }

  async listLedgerAccounts(): Promise<SageLedgerAccount[]> {
    this.assertVerified();
  }

  async listTaxRates(): Promise<SageTaxRate[]> {
    this.assertVerified();
  }
}
