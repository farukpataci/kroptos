import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { IFortnoxClient } from './fortnox.client';
import {
  FortnoxArticle,
  FortnoxCustomer,
  FortnoxFinancialYear,
  FortnoxInvoice,
  FortnoxPayment,
} from './fortnox.types';

export class FortnoxProductionClient implements IFortnoxClient {
  async getCompanyInformation(): Promise<any> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async getFinancialYears(_date?: string): Promise<FortnoxFinancialYear[]> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async createInvoice(_invoice: FortnoxInvoice): Promise<FortnoxInvoice> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async getInvoice(_documentNumber: string | number): Promise<FortnoxInvoice> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async bookkeepInvoice(_documentNumber: string | number): Promise<FortnoxInvoice> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async cancelInvoice(_documentNumber: string | number): Promise<FortnoxInvoice> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async creditInvoice(_documentNumber: string | number): Promise<FortnoxInvoice> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async searchInvoicesByOrderNumber(_orderNumber: string): Promise<FortnoxInvoice[]> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async createCustomer(_customer: FortnoxCustomer): Promise<FortnoxCustomer> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async getCustomer(_customerNumber: string): Promise<FortnoxCustomer | null> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async createArticle(_article: FortnoxArticle): Promise<FortnoxArticle> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async getArticle(_articleNumber: string): Promise<FortnoxArticle | null> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }

  async createPayment(_payment: FortnoxPayment): Promise<FortnoxPayment> {
    throw new IntegrationNotVerifiedError('FORTNOX', 'PRODUCTION');
  }
}
