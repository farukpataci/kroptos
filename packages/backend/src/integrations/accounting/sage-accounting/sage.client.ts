import {
  SageBusiness,
  SageContact,
  SageContactCreatePayload,
  SageLedgerAccount,
  SageSalesInvoice,
  SageSalesInvoiceCreatePayload,
  SageTaxRate,
} from './sage.types';

export interface ISageClient {
  testConnection(): Promise<{
    success: boolean;
    message: string;
    companyName?: string;
    companyId?: string;
  }>;

  createSalesInvoice(
    payload: SageSalesInvoiceCreatePayload,
  ): Promise<SageSalesInvoice>;

  getSalesInvoice(id: string): Promise<SageSalesInvoice>;

  syncContact(payload: SageContactCreatePayload): Promise<SageContact>;

  findInvoiceByReference(
    referenceCode: string,
  ): Promise<SageSalesInvoice | null>;

  listBusinesses(): Promise<SageBusiness[]>;

  listLedgerAccounts(): Promise<SageLedgerAccount[]>;

  listTaxRates(): Promise<SageTaxRate[]>;
}
