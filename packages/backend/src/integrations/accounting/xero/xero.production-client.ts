import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { IXeroClient } from './xero.client';
import {
  XeroConnection,
  XeroContact,
  XeroInvoice,
  XeroItem,
  XeroPayment,
  XeroTaxRate,
} from './xero.types';

export class XeroProductionClient implements IXeroClient {
  constructor(private readonly _credentials: Record<string, any> = {}) {}

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    companyName?: string;
    companyId?: string;
  }> {
    throw new IntegrationNotVerifiedError('XERO', 'PRODUCTION');
  }

  async createDraftInvoice(_invoice: XeroInvoice): Promise<XeroInvoice> {
    throw new IntegrationNotVerifiedError('XERO', 'PRODUCTION');
  }

  async authorizeInvoice(_invoiceId: string): Promise<XeroInvoice> {
    throw new IntegrationNotVerifiedError('XERO', 'PRODUCTION');
  }

  async getInvoice(_invoiceId: string): Promise<XeroInvoice | null> {
    throw new IntegrationNotVerifiedError('XERO', 'PRODUCTION');
  }

  async findInvoiceByReference(_reference: string): Promise<XeroInvoice | null> {
    throw new IntegrationNotVerifiedError('XERO', 'PRODUCTION');
  }

  async createOrUpdateContact(_contact: XeroContact): Promise<XeroContact> {
    throw new IntegrationNotVerifiedError('XERO', 'PRODUCTION');
  }

  async createOrUpdateItem(_item: XeroItem): Promise<XeroItem> {
    throw new IntegrationNotVerifiedError('XERO', 'PRODUCTION');
  }

  async createPayment(_payment: XeroPayment): Promise<XeroPayment> {
    throw new IntegrationNotVerifiedError('XERO', 'PRODUCTION');
  }

  async getConnections(): Promise<XeroConnection[]> {
    throw new IntegrationNotVerifiedError('XERO', 'PRODUCTION');
  }

  async getTaxRates(): Promise<XeroTaxRate[]> {
    throw new IntegrationNotVerifiedError('XERO', 'PRODUCTION');
  }
}
