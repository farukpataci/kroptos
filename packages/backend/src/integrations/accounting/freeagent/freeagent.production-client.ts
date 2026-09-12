import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { IFreeAgentClient } from './freeagent.client';
import {
  FreeAgentBankAccount,
  FreeAgentBankTransactionExplanation,
  FreeAgentCategory,
  FreeAgentCompany,
  FreeAgentContact,
  FreeAgentInvoice,
  FreeAgentInvoiceTransition,
  FreeAgentPaginatedResponse,
  FreeAgentPaginationParams,
  FreeAgentUser,
} from './freeagent.types';

export class FreeAgentProductionClient implements IFreeAgentClient {
  private guard(): never {
    throw new IntegrationNotVerifiedError('freeagent', 'PRODUCTION');
  }

  async getCompany(): Promise<FreeAgentCompany> {
    this.guard();
  }

  async getCurrentUser(): Promise<FreeAgentUser> {
    this.guard();
  }

  async listContacts(_params?: FreeAgentPaginationParams): Promise<FreeAgentPaginatedResponse<FreeAgentContact>> {
    this.guard();
  }

  async getContact(_idOrUrl: string | number): Promise<FreeAgentContact> {
    this.guard();
  }

  async createContact(_contact: Partial<FreeAgentContact>): Promise<FreeAgentContact> {
    this.guard();
  }

  async listCategories(): Promise<FreeAgentCategory[]> {
    this.guard();
  }

  async listBankAccounts(): Promise<FreeAgentBankAccount[]> {
    this.guard();
  }

  async createDraftInvoice(_invoice: Partial<FreeAgentInvoice>): Promise<FreeAgentInvoice> {
    this.guard();
  }

  async getInvoice(_idOrUrl: string | number): Promise<FreeAgentInvoice> {
    this.guard();
  }

  async listInvoices(_params?: FreeAgentPaginationParams): Promise<FreeAgentPaginatedResponse<FreeAgentInvoice>> {
    this.guard();
  }

  async transitionInvoice(
    _idOrUrl: string | number,
    _transition: FreeAgentInvoiceTransition,
  ): Promise<FreeAgentInvoice> {
    this.guard();
  }

  async deleteInvoice(_idOrUrl: string | number): Promise<{ success: boolean }> {
    this.guard();
  }

  async createBankTransactionExplanation(
    _explanation: FreeAgentBankTransactionExplanation,
  ): Promise<FreeAgentBankTransactionExplanation> {
    this.guard();
  }
}
