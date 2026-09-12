import {
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
} from '../core/AccountingTypes';
import { AccountingApiError } from '../core/AccountingErrors';
import { IVismaClient } from './visma.client';
import { VismaBackgroundManager } from './visma.background';
import { VismaRequestMapper } from './visma.request-mapper';
import { VismaResponseMapper } from './visma.response-mapper';
import {
  VismaCustomerConfig,
  VismaCustomerInvoiceDto,
  VismaReconciliationResult,
} from './visma.types';

export class VismaInvoiceFlow {
  /**
   * Reconcile Visma calculated total with KroptOS order total (§5.4).
   * Tolerance: 0.05 currency units.
   */
  static reconcile(
    kroptosTotal: number,
    vismaTotal: number,
    currency = 'EUR',
  ): VismaReconciliationResult {
    const diff = Math.abs(vismaTotal - kroptosTotal);
    const matched = diff <= 0.05;

    return {
      matched,
      kroptosTotal,
      vismaTotal,
      diff: Number(diff.toFixed(4)),
      currency,
      reason: matched
        ? undefined
        : `Visma.net ERP sunucu toplamı (${vismaTotal} ${currency}) KroptOS sipariş toplamıyla (${kroptosTotal} ${currency}) uyuşmuyor: fark ${diff.toFixed(2)} ${currency}. Fatura taslak (Balanced) durumunda bekletiliyor, serbest bırakılmadı.`,
    };
  }

  /**
   * Execute full invoice creation flow (§3.2, §5.4, §5.5)
   */
  static async executeCreateInvoice(params: {
    client: IVismaClient;
    request: AccountingInvoiceRequest;
    config: VismaCustomerConfig;
    backgroundManager: VismaBackgroundManager;
    onOperationCommitted?: (operationId: string) => Promise<void>;
  }): Promise<AccountingInvoiceResult> {
    const { client, request, config, backgroundManager } = params;

    // 1. Idempotency check via customerRefNo (§4.2 #h, §5.2)
    const existing = await client.findInvoiceByReference(request.referenceCode);
    if (existing) {
      return VismaResponseMapper.toInvoiceResult(existing, {
        idempotentReplay: true,
      });
    }

    // 2. Prepare payload
    const dto = VismaRequestMapper.toCustomerInvoiceDto(request, config);

    // 3. Commit callback wrapper
    const commitCallback = params.onOperationCommitted || (async () => {});

    // 4. Background execution (§3.2)
    const bgResult = await backgroundManager.executeBackgroundOperation<VismaCustomerInvoiceDto>({
      requestFn: () => client.createCustomerInvoiceBackground(dto),
      onOperationCommitted: commitCallback,
      pollStatusFn: (jobId, stateLocation) => client.pollBackgroundJob(jobId, stateLocation),
      fetchContentFn: (contentLocation) => client.fetchBackgroundContent<VismaCustomerInvoiceDto>(contentLocation),
    });

    if (bgResult.status === 'failed') {
      throw new AccountingApiError(
        'VISMA-NET-ERP',
        500,
        bgResult.errorMessage || 'Visma.net ERP arka plan fatura oluşturma operasyonu başarısız oldu.',
      );
    }

    if (bgResult.status === 'pending' || bgResult.deferred || !bgResult.data) {
      // Deferred due to max attempts: keep in-flight with op: ID
      return {
        externalId: bgResult.operationId,
        externalNumber: bgResult.operationId,
        rawResponse: {
          operationId: bgResult.operationId,
          deferred: true,
          status: 'InProcess',
          providerStatus: 'InProcess',
          message: bgResult.errorMessage,
        },
      };
    }

    const draftInvoice = bgResult.data;
    const invNumber = draftInvoice.invoiceNumber || draftInvoice.referenceNumber?.value;

    if (!invNumber) {
      throw new Error('Visma.net ERP faturasından fatura numarası alınamadı.');
    }

    // 5. Reconciliation (§5.4)
    const kroptosTotal = Number(request.grandTotal);
    const vismaTotal = Number(draftInvoice.amount ?? 0);
    const recon = this.reconcile(kroptosTotal, vismaTotal, request.currency);

    if (!recon.matched) {
      // STOP! Do NOT release. Remain in Balanced draft.
      return VismaResponseMapper.toInvoiceResult(draftInvoice, {
        providerStatus: 'Balanced',
        reconciliationMismatch: true,
        reconciliationDiff: recon.diff,
        reconciliationMessage: recon.reason,
        vismaTotal: recon.vismaTotal,
        kroptosTotal: recon.kroptosTotal,
      });
    }

    // 6. Release action (§5.5)
    // Server totals MATCH -> Release invoice to Open status
    await client.releaseInvoice(invNumber);

    // 7. Re-read invoice directly (§5.5 bilinen sınır)
    // Action endpoints do not return final document status in background response;
    // hence we read back the invoice directly.
    const postedInvoice = await client.getInvoice(invNumber);

    const rawStatus = postedInvoice.status
      ? typeof postedInvoice.status === 'object' && 'value' in postedInvoice.status
        ? postedInvoice.status.value
        : String(postedInvoice.status)
      : 'Open';

    return VismaResponseMapper.toInvoiceResult(postedInvoice, {
      providerStatus: rawStatus,
      reconciliationMatched: true,
      vismaTotal: recon.vismaTotal,
      kroptosTotal: recon.kroptosTotal,
    });
  }
}
