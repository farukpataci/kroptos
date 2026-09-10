import {
  BusinessCentralCompany,
  BusinessCentralCustomer,
  BusinessCentralItem,
  BusinessCentralSalesInvoiceHeader,
  BusinessCentralSalesInvoiceLine,
} from './bc.types';

export interface IBusinessCentralClient {
  testConnection(): Promise<{ success: boolean; message: string; companyName?: string; companyId?: string }>;
  
  createDraftInvoice(
    header: Partial<BusinessCentralSalesInvoiceHeader>,
  ): Promise<BusinessCentralSalesInvoiceHeader>;

  createInvoiceLine(
    line: Partial<BusinessCentralSalesInvoiceLine>,
  ): Promise<BusinessCentralSalesInvoiceLine>;

  getInvoice(
    id: string,
    expandLines?: boolean,
  ): Promise<BusinessCentralSalesInvoiceHeader>;

  postInvoice(id: string): Promise<void>;

  cancelInvoice(id: string): Promise<void>;

  deleteDraftInvoice(id: string, etag?: string): Promise<void>;

  findInvoiceByReference(
    referenceCode: string,
  ): Promise<BusinessCentralSalesInvoiceHeader | null>;

  syncCustomer(
    customer: Partial<BusinessCentralCustomer>,
  ): Promise<BusinessCentralCustomer>;

  mapItem(item: Partial<BusinessCentralItem>): Promise<BusinessCentralItem>;

  getCompanies(): Promise<BusinessCentralCompany[]>;
}
