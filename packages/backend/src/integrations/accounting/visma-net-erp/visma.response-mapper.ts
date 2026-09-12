import { AccountingInvoiceResult } from '../core/AccountingTypes';
import { VismaCustomerInvoiceDto } from './visma.types';

export class VismaResponseMapper {
  /**
   * Map Visma.net ERP CustomerInvoice DTO to standard AccountingInvoiceResult.
   */
  static toInvoiceResult(
    dto: VismaCustomerInvoiceDto,
    options?: {
      idempotentReplay?: boolean;
      providerStatus?: string;
      reconciliationMismatch?: boolean;
      reconciliationDiff?: number;
      reconciliationMessage?: string;
      vismaTotal?: number;
      kroptosTotal?: number;
      reconciliationMatched?: boolean;
    },
  ): AccountingInvoiceResult {
    const rawStatus = dto.status
      ? typeof dto.status === 'object' && 'value' in dto.status
        ? dto.status.value
        : String(dto.status)
      : 'Balanced';

    const finalStatus = options?.providerStatus || rawStatus;
    const invNumber = dto.invoiceNumber || dto.referenceNumber?.value || '';

    return {
      externalId: invNumber,
      externalNumber: invNumber,
      rawResponse: {
        invoiceNumber: invNumber,
        status: finalStatus,
        providerStatus: finalStatus,
        amount: dto.amount,
        vatAmount: dto.vatAmount,
        customerRefNo: dto.customerRefNo?.value,
        timestamp: dto.timestamp,
        reconciliationMismatch: options?.reconciliationMismatch,
        reconciliationDiff: options?.reconciliationDiff,
        reconciliationMessage: options?.reconciliationMessage,
        reconciliationMatched: options?.reconciliationMatched,
        idempotentReplay: options?.idempotentReplay,
      },
    };
  }
}
