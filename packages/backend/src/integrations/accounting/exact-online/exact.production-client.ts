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

export class ExactProductionClient implements IExactClient {
  constructor() {}

  async getMe(): Promise<ExactMeResponse> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async listDivisions(): Promise<ExactDivision[]> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async getDivision(_code: number | string): Promise<ExactDivision> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async listAccounts(_division: number | string, _params?: ExactPaginationParams): Promise<ExactODataResponse<ExactAccount>> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async getAccount(_division: number | string, _id: string): Promise<ExactAccount> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async createAccount(_division: number | string, _account: Partial<ExactAccount>): Promise<ExactAccount> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async listItems(_division: number | string, _params?: ExactPaginationParams): Promise<ExactODataResponse<ExactItem>> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async listVATCodes(_division: number | string): Promise<ExactVATCode[]> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async createSalesInvoice(_division: number | string, _invoice: Partial<ExactSalesInvoice>): Promise<ExactSalesInvoice> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async getSalesInvoice(_division: number | string, _id: string): Promise<ExactSalesInvoice> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async findSalesInvoiceByReference(_division: number | string, _reference: string): Promise<ExactSalesInvoice | null> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async cancelSalesInvoice(_division: number | string, _id: string): Promise<ExactSalesInvoice> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
  async getSyncDeleted(_division: number | string, _entityType: string, _timestamp?: number): Promise<any[]> {
    throw new IntegrationNotVerifiedError('EXACT-ONLINE', 'PRODUCTION');
  }
}
