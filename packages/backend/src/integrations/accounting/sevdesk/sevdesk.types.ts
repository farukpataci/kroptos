/**
 * sevDesk API v1 Types & DTOs
 *
 * Base URL: https://my.sevdesk.de/api/v1
 * All entities return or expect standard JSON objects or { objects: [...] } envelope.
 */

export type SevdeskObjectName =
  | 'Invoice'
  | 'InvoicePos'
  | 'Contact'
  | 'ContactAddress'
  | 'Unity'
  | 'SevUser'
  | 'CheckAccount'
  | 'CheckAccountTransaction'
  | 'Order'
  | 'CreditNote'
  | 'Voucher'
  | 'Part'
  | 'Tag'
  | 'TaxRule'
  | 'TaxSet'
  | 'Category'
  | 'StaticCountry'
  | 'PaymentMethod';

/**
 * §5.3 sevDesk objectName reference envelope
 */
export interface SevdeskRef<TName extends SevdeskObjectName = SevdeskObjectName> {
  id: number | string;
  objectName: TName;
}

export type SevdeskInvoiceStatus =
  | 50 // Deactivated (recurring invoices)
  | 100 // Draft
  | 200 // Open
  | 1000; // Paid

export interface SevdeskResponse<T> {
  objects: T[];
  total?: number;
}

export interface SevdeskUser {
  id: string | number;
  objectName: 'SevUser';
  username?: string;
  fullname?: string;
  email?: string;
  status?: number;
  role?: string;
}

export interface SevdeskContact {
  id: string | number;
  objectName: 'Contact';
  name?: string;
  customerNumber?: string;
  surename?: string;
  familyname?: string;
  titel?: string;
  category?: SevdeskRef<'Category'>;
  description?: string;
  academicTitle?: string;
  gender?: string;
  status?: number;
}

export interface SevdeskInvoicePos {
  id?: string | number;
  objectName: 'InvoicePos';
  invoice?: SevdeskRef<'Invoice'>;
  part?: SevdeskRef<'Part'>;
  quantity: number;
  price: number;
  name: string;
  unity: SevdeskRef<'Unity'>;
  positionNumber?: number;
  text?: string;
  discount?: number;
  taxRate: number;
  priceNet?: number;
  priceTax?: number;
  priceGross?: number;
  sumNet?: number;
  sumTax?: number;
  sumGross?: number;
}

export interface SevdeskInvoice {
  id: string | number;
  objectName: 'Invoice';
  invoiceNumber?: string;
  contact: SevdeskRef<'Contact'>;
  invoiceDate: string;
  header?: string;
  headText?: string;
  footText?: string;
  timeToPay?: number;
  discountTime?: number;
  discount?: number;
  addressName?: string;
  addressStreet?: string;
  addressZip?: string;
  addressCity?: string;
  addressCountry?: SevdeskRef<'StaticCountry'>;
  status: SevdeskInvoiceStatus;
  smallSettlement?: boolean;
  contactPerson?: SevdeskRef<'SevUser'>;
  taxRate?: number;
  taxRule?: SevdeskRef<'TaxRule'>;
  taxSet?: SevdeskRef<'TaxSet'>;
  paymentMethod?: SevdeskRef<'PaymentMethod'>;
  sendDate?: string;
  invoiceType: 'RE' | 'WKR' | 'SR' | 'MA';
  currency?: string;
  customerInternalNote?: string;
  showNet?: boolean;
  sendType?: 'VPR' | 'VP' | 'VM' | 'VPDF';
  sumNet?: number;
  sumTax?: number;
  sumGross?: number;
  sumDiscounts?: number;
  sumNetAccounting?: number;
  sumTaxAccounting?: number;
  sumGrossAccounting?: number;
  paidAmount?: number;
}

export interface SevdeskInvoiceFactoryPayload {
  invoice: Partial<SevdeskInvoice> & {
    contact: SevdeskRef<'Contact'>;
    invoiceDate: string;
    status: 100; // Always starts as Draft (§5.1)
  };
  invoicePosSave?: Array<
    Partial<SevdeskInvoicePos> & {
      name: string;
      quantity: number;
      price: number;
      taxRate: number;
      unity: SevdeskRef<'Unity'>;
      objectName: 'InvoicePos';
    }
  >;
  invoicePosDelete?: null;
  discountSave?: null;
  discountDelete?: null;
  takeDefaultAddress?: boolean;
}

export interface SevdeskBookAmountPayload {
  amount: number;
  date: string;
  type: 'N' | 'CB'; // Normal payment or Chargeback
  checkAccount: SevdeskRef<'CheckAccount'>;
  checkAccountTransaction?: SevdeskRef<'CheckAccountTransaction'>;
  createFeed?: boolean;
}

export interface SevdeskReconciliationResult {
  matched: boolean;
  kroptosTotal: number;
  sevdeskTotal: number;
  diff: number;
  currency: string;
  reason?: string;
}
