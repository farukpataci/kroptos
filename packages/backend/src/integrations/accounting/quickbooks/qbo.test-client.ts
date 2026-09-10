import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { BaseQBOClient } from './qbo.client';
import {
  QBOCustomer,
  QBOInvoice,
  QBOItem,
  QBOPayment,
  QBOPreferences,
  QBOCompanyInfo,
} from './qbo.types';

export class QBOTestClient extends BaseQBOClient {
  constructor(realmId: string) {
    super(realmId);
  }

  private fail(): never {
    throw new IntegrationNotVerifiedError('quickbooks', 'TEST');
  }

  createInvoice(_invoice: QBOInvoice, _requestId?: string): Promise<QBOInvoice> {
    this.fail();
  }
  getInvoice(_id: string): Promise<QBOInvoice> {
    this.fail();
  }
  findInvoiceByDocNumber(_docNumber: string): Promise<QBOInvoice | null> {
    this.fail();
  }
  voidInvoice(_id: string, _syncToken: string): Promise<QBOInvoice> {
    this.fail();
  }
  deleteInvoice(_id: string, _syncToken: string): Promise<{ status: string }> {
    this.fail();
  }
  createCustomer(_customer: QBOCustomer): Promise<QBOCustomer> {
    this.fail();
  }
  findCustomer(_search: string): Promise<QBOCustomer | null> {
    this.fail();
  }
  createPayment(_payment: QBOPayment): Promise<QBOPayment> {
    this.fail();
  }
  createItem(_item: QBOItem): Promise<QBOItem> {
    this.fail();
  }
  getPreferences(): Promise<QBOPreferences> {
    this.fail();
  }
  getCompanyInfo(): Promise<QBOCompanyInfo> {
    this.fail();
  }
}
