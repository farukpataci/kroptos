import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { ISevdeskClient } from './sevdesk.client';
import {
  SevdeskBookAmountPayload,
  SevdeskContact,
  SevdeskInvoice,
  SevdeskInvoiceFactoryPayload,
  SevdeskUser,
} from './sevdesk.types';

export class SevdeskTestClient implements ISevdeskClient {
  private guard(): never {
    throw new IntegrationNotVerifiedError('sevdesk', 'TEST');
  }

  async getCurrentUser(): Promise<SevdeskUser> {
    this.guard();
  }

  async createDraftInvoice(_payload: SevdeskInvoiceFactoryPayload): Promise<SevdeskInvoice> {
    this.guard();
  }

  async getInvoice(_id: string | number): Promise<SevdeskInvoice> {
    this.guard();
  }

  async bookAmount(
    _invoiceId: string | number,
    _payload: SevdeskBookAmountPayload,
  ): Promise<SevdeskInvoice> {
    this.guard();
  }

  async resetToDraft(_invoiceId: string | number): Promise<SevdeskInvoice> {
    this.guard();
  }

  async resetToOpen(_invoiceId: string | number): Promise<SevdeskInvoice> {
    this.guard();
  }

  async listInvoices(_params?: { limit?: number; offset?: number; status?: number }): Promise<SevdeskInvoice[]> {
    this.guard();
  }

  async listContacts(_params?: { limit?: number; offset?: number }): Promise<SevdeskContact[]> {
    this.guard();
  }

  async createContact(_contact: Partial<SevdeskContact>): Promise<SevdeskContact> {
    this.guard();
  }
}
