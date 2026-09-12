import { AccountingInvoiceResult } from '../core/AccountingTypes';
import { FreeAgentUriHelper } from './freeagent.uri';
import { FreeAgentStatusMapper } from './freeagent.status-mapper';
import { FreeAgentInvoice } from './freeagent.types';

export class FreeAgentResponseMapper {
  static toInvoiceResult(
    invoice: FreeAgentInvoice,
    meta?: {
      reconciled?: boolean;
      operatorNote?: string;
      transition?: string;
    },
  ): AccountingInvoiceResult {
    const externalId = invoice.url
      ? FreeAgentUriHelper.extractResourceId(invoice.url, 'invoices')
      : String(invoice.id || '');

    const documentStatus = FreeAgentStatusMapper.toKroptosStatus(invoice.status);

    return {
      externalId,
      externalNumber: invoice.reference,
      rawResponse: {
        success: true,
        provider: 'freeagent',
        status: invoice.status,
        documentStatus,
        url: invoice.url,
        reference: invoice.reference,
        po_reference: invoice.po_reference,
        net_value: invoice.net_value,
        sales_tax_value: invoice.sales_tax_value,
        total_value: invoice.total_value,
        paid_value: invoice.paid_value,
        due_value: invoice.due_value,
        currency: invoice.currency,
        reconciled: meta?.reconciled ?? true,
        operatorNote: meta?.operatorNote,
        transition: meta?.transition,
      },
    };
  }
}
