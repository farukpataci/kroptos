import { AccountingInvoiceResult } from '../core/AccountingTypes';
import { ExactSalesInvoice } from './exact.types';

export class ExactResponseMapper {
  static toInvoiceResult(
    invoice: ExactSalesInvoice,
    extraMeta?: Record<string, any>,
  ): AccountingInvoiceResult {
    return {
      externalId: invoice.InvoiceID || '',
      externalNumber: invoice.InvoiceNumber ? String(invoice.InvoiceNumber) : undefined,
      rawResponse: {
        ...invoice,
        ...extraMeta,
      },
    };
  }
}
