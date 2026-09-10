import {
  AccountingContactResult,
  AccountingInvoiceResult,
  AccountingPaymentResult,
  AccountingProductResult,
} from '../core/AccountingTypes';
import {
  XeroContact,
  XeroInvoice,
  XeroItem,
  XeroPayment,
} from './xero.types';

export class XeroResponseMapper {
  static toInvoiceResult(xeroInvoice: XeroInvoice): AccountingInvoiceResult {
    return {
      externalId: xeroInvoice.InvoiceID || '',
      externalNumber: xeroInvoice.InvoiceNumber,
      rawResponse: xeroInvoice as unknown as Record<string, any>,
    };
  }

  static toContactResult(xeroContact: XeroContact): AccountingContactResult {
    return {
      externalId: xeroContact.ContactID || '',
      rawResponse: xeroContact as unknown as Record<string, any>,
    };
  }

  static toProductResult(xeroItem: XeroItem): AccountingProductResult {
    return {
      externalId: xeroItem.ItemID || xeroItem.Code,
      code: xeroItem.Code,
      rawResponse: xeroItem as unknown as Record<string, any>,
    };
  }

  static toPaymentResult(xeroPayment: XeroPayment): AccountingPaymentResult {
    return {
      externalId: xeroPayment.PaymentID || '',
      rawResponse: xeroPayment as unknown as Record<string, any>,
    };
  }
}
