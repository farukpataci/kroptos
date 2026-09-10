import {
  XeroConnection,
  XeroContact,
  XeroInvoice,
  XeroItem,
  XeroPayment,
  XeroTaxRate,
} from './xero.types';

export interface IXeroClient {
  testConnection(): Promise<{
    success: boolean;
    message: string;
    companyName?: string;
    companyId?: string;
  }>;
  createDraftInvoice(invoice: XeroInvoice): Promise<XeroInvoice>;
  authorizeInvoice(invoiceId: string): Promise<XeroInvoice>;
  getInvoice(invoiceId: string): Promise<XeroInvoice | null>;
  findInvoiceByReference(reference: string): Promise<XeroInvoice | null>;
  createOrUpdateContact(contact: XeroContact): Promise<XeroContact>;
  createOrUpdateItem(item: XeroItem): Promise<XeroItem>;
  createPayment(payment: XeroPayment): Promise<XeroPayment>;
  getConnections(): Promise<XeroConnection[]>;
  getTaxRates(): Promise<XeroTaxRate[]>;
}
