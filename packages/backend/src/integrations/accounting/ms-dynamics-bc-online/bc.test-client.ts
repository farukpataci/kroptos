import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { IBusinessCentralClient } from './bc.client';
import {
  BusinessCentralCompany,
  BusinessCentralCustomer,
  BusinessCentralItem,
  BusinessCentralSalesInvoiceHeader,
  BusinessCentralSalesInvoiceLine,
} from './bc.types';

export class BusinessCentralTestClient implements IBusinessCentralClient {
  constructor(private readonly credentials: Record<string, any> = {}) {}

  private assertVerified(): never {
    throw new IntegrationNotVerifiedError('MS_DYNAMICS_BC_ONLINE', 'TEST');
  }

  async testConnection(): Promise<any> {
    this.assertVerified();
  }

  async createDraftInvoice(
    _header: Partial<BusinessCentralSalesInvoiceHeader>,
  ): Promise<BusinessCentralSalesInvoiceHeader> {
    this.assertVerified();
  }

  async createInvoiceLine(
    _line: Partial<BusinessCentralSalesInvoiceLine>,
  ): Promise<BusinessCentralSalesInvoiceLine> {
    this.assertVerified();
  }

  async getInvoice(
    _id: string,
    _expandLines?: boolean,
  ): Promise<BusinessCentralSalesInvoiceHeader> {
    this.assertVerified();
  }

  async postInvoice(_id: string): Promise<void> {
    this.assertVerified();
  }

  async cancelInvoice(_id: string): Promise<void> {
    this.assertVerified();
  }

  async deleteDraftInvoice(_id: string, _etag?: string): Promise<void> {
    this.assertVerified();
  }

  async findInvoiceByReference(
    _referenceCode: string,
  ): Promise<BusinessCentralSalesInvoiceHeader | null> {
    this.assertVerified();
  }

  async syncCustomer(
    _customer: Partial<BusinessCentralCustomer>,
  ): Promise<BusinessCentralCustomer> {
    this.assertVerified();
  }

  async mapItem(_item: Partial<BusinessCentralItem>): Promise<BusinessCentralItem> {
    this.assertVerified();
  }

  async getCompanies(): Promise<BusinessCentralCompany[]> {
    this.assertVerified();
  }
}
