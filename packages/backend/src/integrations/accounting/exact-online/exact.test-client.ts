import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { ExactPaginationParams, IExactClient } from './exact.client';
import {
  ExactAccount,
  ExactDivision,
  ExactItem,
  ExactMeResponse,
  ExactODataResponse,
  ExactSalesInvoice,
  ExactVATCode,
} from './exact.types';

export class ExactTestClient implements IExactClient {
  constructor() {}

  async getMe(): Promise<ExactMeResponse> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async listDivisions(): Promise<ExactDivision[]> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async getDivision(_code: number | string): Promise<ExactDivision> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async listAccounts(_division: number | string, _params?: ExactPaginationParams): Promise<ExactODataResponse<ExactAccount>> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async getAccount(_division: number | string, _id: string): Promise<ExactAccount> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async createAccount(_division: number | string, _account: Partial<ExactAccount>): Promise<ExactAccount> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async listItems(_division: number | string, _params?: ExactPaginationParams): Promise<ExactODataResponse<ExactItem>> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async listVATCodes(_division: number | string): Promise<ExactVATCode[]> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async createSalesInvoice(_division: number | string, _invoice: Partial<ExactSalesInvoice>): Promise<ExactSalesInvoice> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async getSalesInvoice(_division: number | string, _id: string): Promise<ExactSalesInvoice> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async findSalesInvoiceByReference(_division: number | string, _reference: string): Promise<ExactSalesInvoice | null> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async cancelSalesInvoice(_division: number | string, _id: string): Promise<ExactSalesInvoice> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
  async getSyncDeleted(_division: number | string, _entityType: string, _timestamp?: number): Promise<any[]> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'TEST');
  }
}
