import {
  AccountingContactResult,
  AccountingInvoiceResult,
  AccountingPaymentResult,
  AccountingProductResult,
} from '../core/AccountingTypes';
import { QBOStatusMapper } from './qbo.status-mapper';
import { QBOCustomer, QBOInvoice, QBOItem, QBOPayment } from './qbo.types';

export class QBOResponseMapper {
  static toInvoiceResult(
    invoice: QBOInvoice,
    hasAmountMismatch?: boolean,
    amountDifference?: number,
  ): AccountingInvoiceResult {
    const derivedStatus = QBOStatusMapper.deriveStatus(invoice);

    const res: AccountingInvoiceResult = {
      externalId: invoice.Id || '',
      externalNumber: invoice.DocNumber,
      rawResponse: {
        ...invoice,
        status: derivedStatus,
        payableAmount: invoice.Balance ?? invoice.TotalAmt ?? 0,
      },
    };

    if (hasAmountMismatch) {
      (res.rawResponse as any).hasAmountMismatch = true;
      (res.rawResponse as any).amountDifference = amountDifference;
    }

    return res;
  }

  static toContactResult(customer: QBOCustomer): AccountingContactResult {
    return {
      externalId: customer.Id || '',
      rawResponse: customer,
    };
  }

  static toPaymentResult(payment: QBOPayment): AccountingPaymentResult {
    return {
      externalId: payment.Id || '',
      rawResponse: payment,
    };
  }

  static toProductResult(item: QBOItem): AccountingProductResult {
    return {
      externalId: item.Id || '',
      rawResponse: item,
    };
  }
}
