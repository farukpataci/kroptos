/**
 * Fatture in Cloud (TeamSystem) Invoice Flow Orchestrator
 * Reference: §2.1, §5.1, §5.3, §5.5, §5.8
 */

import { AccountingInvoiceRequest, AccountingInvoiceResult } from '../core/AccountingTypes';
import { FicHttpClient } from './fic.client';
import { FicDocumentMapper, FicDocumentMappingOptions } from './fic.document-mapper';
import { FicEInvoiceService } from './fic.einvoice';
import { FicResponseMapper } from './fic.response-mapper';
import { FicErrorMapper } from './fic.error-mapper';

export class FicInvoiceFlow {
  /**
   * Executes the complete invoice flow in Fatture in Cloud:
   * 1. Validates and maps KroptOS request to FIC payload
   * 2. Calls createIssuedDocument
   * 3. Performs dry_run e-invoice XML verification (§5.8)
   * 4. Maps response with isolated ei_status
   */
  static async execute(
    client: FicHttpClient,
    request: AccountingInvoiceRequest,
    options: FicDocumentMappingOptions,
  ): Promise<AccountingInvoiceResult> {
    try {
      // 1. Build & Validate payload (§5.3, §5.4, §5.5)
      const payload = FicDocumentMapper.toIssuedDocumentPayload(request, options);

      // 2. Create document in FIC
      const createRes = await client.createIssuedDocument(options.companyId, payload);
      const document = createRes.data;

      // 3. Dry-run e-invoice verification if e-invoice is enabled (§5.8)
      let dryRunResult;
      if (document.e_invoice) {
        dryRunResult = await FicEInvoiceService.verifyXmlDryRun(
          client,
          options.companyId,
          document.id,
        );
      }

      // 4. Map response (§5.2, §6)
      const result = FicResponseMapper.toInvoiceResult(document);

      if (dryRunResult && result.rawResponse) {
        result.rawResponse.dry_run_verified = dryRunResult.verified;
        result.rawResponse.dry_run_error = dryRunResult.error;
        if (dryRunResult.eiStatus) {
          result.rawResponse.ei_status = dryRunResult.eiStatus;
        }
      }

      return result;
    } catch (err: any) {
      throw FicErrorMapper.mapError(err, 'Fatura Oluşturma');
    }
  }
}
