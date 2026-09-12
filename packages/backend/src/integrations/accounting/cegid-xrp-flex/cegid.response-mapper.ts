import {
  AccountingContactResult,
  AccountingInvoiceResult,
  AccountingPaymentResult,
} from '../core/AccountingTypes';
import {
  CegidCustomer,
  CegidPayment,
  CegidSalesInvoice,
} from './cegid.types';

export class CegidResponseMapper {
  /**
   * Cegid SalesInvoice modelini standart AccountingInvoiceResult'a eşler.
   */
  static toInvoiceResult(
    doc: CegidSalesInvoice,
    options?: {
      idempotentReplay?: boolean;
      providerStatus?: string;
      reconciliationMismatch?: boolean;
      reconciliationDiff?: number;
      reconciliationMessage?: string;
      cegidTotal?: number;
      kroptosTotal?: number;
      reconciliationMatched?: boolean;
    },
  ): AccountingInvoiceResult {
    const rawRef = doc.ReferenceNbr?.value || doc.id || '';
    const rawStatus = doc.Status?.value || (doc.Hold?.value ? 'Hold' : 'Open');
    const finalStatus = options?.providerStatus || rawStatus;

    return {
      externalId: rawRef,
      externalNumber: rawRef,
      rawResponse: {
        referenceNumber: rawRef,
        status: finalStatus,
        providerStatus: finalStatus,
        hold: doc.Hold?.value,
        amount: doc.Amount?.value,
        taxTotal: doc.TaxTotal?.value,
        customerOrder: doc.CustomerOrder?.value,
        reconciliationMismatch: options?.reconciliationMismatch,
        reconciliationDiff: options?.reconciliationDiff,
        reconciliationMessage: options?.reconciliationMessage,
        reconciliationMatched: options?.reconciliationMatched,
        idempotentReplay: options?.idempotentReplay,
      },
    };
  }

  /**
   * Cegid Customer modelini standart AccountingContactResult'a eşler.
   */
  static toCustomerResult(cust: CegidCustomer): AccountingContactResult {
    const customerId = cust.CustomerID?.value || cust.id || '';
    return {
      externalId: customerId,
      rawResponse: cust,
    };
  }


  /**
   * Cegid Payment modelini standart AccountingPaymentResult'a eşler.
   */
  static toPaymentResult(pmt: CegidPayment): AccountingPaymentResult {
    const pmtRef = pmt.ReferenceNbr?.value || pmt.id || '';
    return {
      externalId: pmtRef,
      rawResponse: pmt,
    };
  }
}
