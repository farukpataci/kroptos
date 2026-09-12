/**
 * Fatture in Cloud (TeamSystem) Response Mapper
 * Reference: §5.2, §6
 */

import { AccountingInvoiceResult } from '../core/AccountingTypes';
import { FicIssuedDocumentResponse } from './fic.types';
import { FicStatusMapper } from './fic.status-mapper';

export class FicResponseMapper {
  /**
   * Maps FIC IssuedDocument response to KroptOS AccountingInvoiceResult.
   *
   * CRITICAL §5.2 & §6 RULE:
   * ei_status is kept in rawResponse (masked), completely isolated from
   * KroptOS document status.
   */
  static toInvoiceResult(response: FicIssuedDocumentResponse): AccountingInvoiceResult {
    const externalNumber = response.numeration
      ? `${response.numeration}/${response.number}`
      : String(response.number);

    const sanitizedEiStatus = FicStatusMapper.sanitizeEiStatus(response.ei_status);

    return {
      externalId: String(response.id),
      externalNumber,
      rawResponse: {
        id: response.id,
        number: response.number,
        numeration: response.numeration,
        amount_net: response.amount_net,
        amount_vat: response.amount_vat,
        amount_gross: response.amount_gross,
        use_gross_prices: response.use_gross_prices,
        e_invoice: response.e_invoice,
        ei_status: sanitizedEiStatus,
        ei_status_desc: FicStatusMapper.getEiStatusDescription(sanitizedEiStatus),
        created_at: response.created_at,
      },
    };
  }
}
