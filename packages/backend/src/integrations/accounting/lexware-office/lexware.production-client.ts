import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { ILexwareClient } from './lexware.client';

export class LexwareProductionClient implements ILexwareClient {
  constructor(public readonly apiKey: string = '') {}

  private guard(): never {
    throw new IntegrationNotVerifiedError('lexware-office', 'PRODUCTION');
  }

  createDraftInvoice(): Promise<any> {
    this.guard();
  }
  getInvoice(): Promise<any> {
    this.guard();
  }
  finalizeInvoice(): Promise<any> {
    this.guard();
  }
  deleteDraftInvoice(): Promise<any> {
    this.guard();
  }
  createContact(): Promise<any> {
    this.guard();
  }
  getContact(): Promise<any> {
    this.guard();
  }
  createArticle(): Promise<any> {
    this.guard();
  }
  getArticle(): Promise<any> {
    this.guard();
  }
  listInvoices(): Promise<any> {
    this.guard();
  }
  getProfile(): Promise<any> {
    this.guard();
  }
}
