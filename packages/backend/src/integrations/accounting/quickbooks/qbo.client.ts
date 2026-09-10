import {
  QBOCustomer,
  QBOInvoice,
  QBOItem,
  QBOPayment,
  QBOPreferences,
  QBOCompanyInfo,
  QBO_API_MINORVERSION,
} from './qbo.types';

export interface IQBOClient {
  readonly realmId: string;
  createInvoice(invoice: QBOInvoice, requestId?: string): Promise<QBOInvoice>;
  getInvoice(id: string): Promise<QBOInvoice>;
  findInvoiceByDocNumber(docNumber: string): Promise<QBOInvoice | null>;
  voidInvoice(id: string, syncToken: string): Promise<QBOInvoice>;
  deleteInvoice(id: string, syncToken: string): Promise<{ status: string }>;
  createCustomer(customer: QBOCustomer): Promise<QBOCustomer>;
  findCustomer(search: string): Promise<QBOCustomer | null>;
  createPayment(payment: QBOPayment): Promise<QBOPayment>;
  createItem(item: QBOItem): Promise<QBOItem>;
  getPreferences(): Promise<QBOPreferences>;
  getCompanyInfo(): Promise<QBOCompanyInfo>;
}

export abstract class BaseQBOClient implements IQBOClient {
  constructor(public readonly realmId: string) {}

  abstract createInvoice(invoice: QBOInvoice, requestId?: string): Promise<QBOInvoice>;
  abstract getInvoice(id: string): Promise<QBOInvoice>;
  abstract findInvoiceByDocNumber(docNumber: string): Promise<QBOInvoice | null>;
  abstract voidInvoice(id: string, syncToken: string): Promise<QBOInvoice>;
  abstract deleteInvoice(id: string, syncToken: string): Promise<{ status: string }>;
  abstract createCustomer(customer: QBOCustomer): Promise<QBOCustomer>;
  abstract findCustomer(search: string): Promise<QBOCustomer | null>;
  abstract createPayment(payment: QBOPayment): Promise<QBOPayment>;
  abstract createItem(item: QBOItem): Promise<QBOItem>;
  abstract getPreferences(): Promise<QBOPreferences>;
  abstract getCompanyInfo(): Promise<QBOCompanyInfo>;

  /**
   * §3.2 Helper to construct QBO URL with realmId in path and pinned minorversion=75
   */
  protected buildUrl(endpoint: string, queryParams?: Record<string, string>): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = new URL(`https://quickbooks.api.intuit.com/v3/company/${this.realmId}/${cleanEndpoint}`);
    url.searchParams.set('minorversion', QBO_API_MINORVERSION);

    if (queryParams) {
      for (const [key, val] of Object.entries(queryParams)) {
        if (val !== undefined && val !== null) {
          url.searchParams.set(key, val);
        }
      }
    }

    return url.toString();
  }
}
