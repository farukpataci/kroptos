import { AccountingInvoiceResult } from '../core/AccountingTypes';
import { SevdeskStatusMapper } from './sevdesk.status-mapper';
import { SevdeskInvoice } from './sevdesk.types';

export class SevdeskResponseMapper {
  static toInvoiceResult(
    invoice: SevdeskInvoice,
    meta?: { reconciled?: boolean; operatorNote?: string },
  ): AccountingInvoiceResult {
    const status = SevdeskStatusMapper.toKroptosStatus(invoice.status);
    return {
      externalId: String(invoice.id),
      externalNumber: invoice.invoiceNumber || `DRAFT-${invoice.id}`,
      rawResponse: {
        ...invoice,
        status,
        _reconciled: meta?.reconciled ?? false,
        _operatorNote:
          meta?.operatorNote ||
          'Fatura sevDesk üzerinde Taslak (Draft) olarak oluşturuldu. Kesinleştirme işlemi sevDesk paneli üzerinden yürütülmelidir.',
      },
    };
  }
}
