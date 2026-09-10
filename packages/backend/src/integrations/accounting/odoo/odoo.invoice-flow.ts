import {
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
} from '../core/AccountingTypes';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { IOdooTransport } from './odoo.transport';
import { OdooRequestMapper } from './odoo.request-mapper';
import { OdooResponseMapper } from './odoo.response-mapper';
import { OdooMove } from './odoo.types';

export interface OdooReconciliationResult {
  matched: boolean;
  kroptosTotal: number;
  odooTotal: number;
  diff: number;
  currency: string;
  reason?: string;
}

/**
 * Odoo Invoice Flow: Draft -> Read-back -> Reconcile -> Post (§5.4, §5.5)
 */
export class OdooInvoiceFlow {
  /**
   * Reconcile Odoo calculated total with KroptOS order total (§5.4)
   */
  static reconcile(
    kroptosTotal: number,
    odooTotal: number,
    currency: string = 'EUR',
  ): OdooReconciliationResult {
    const diff = Math.abs(odooTotal - kroptosTotal);
    // Strict tolerance (0.05) to accommodate minor fractional tax rounding
    const matched = diff <= 0.05;

    return {
      matched,
      kroptosTotal,
      odooTotal,
      diff: Number(diff.toFixed(2)),
      currency,
      reason: matched
        ? undefined
        : `Odoo hesaplanan toplamı (${odooTotal} ${currency}) sipariş genel toplamıyla (${kroptosTotal} ${currency}) uyuşmuyor: fark ${diff.toFixed(2)} ${currency}. Fatura Odoo'da taslak olarak bekletildi, onaylanmadı.`,
    };
  }

  /**
   * Execute complete invoice creation flow (§5.4)
   */
  static async executeCreateInvoice(
    transport: IOdooTransport,
    request: AccountingInvoiceRequest,
    partnerId: number,
    options?: {
      journalId?: number;
      defaultTaxId?: number;
      companyId?: number | string;
    },
  ): Promise<AccountingInvoiceResult> {
    const companyId = options?.companyId;

    // 1. Idempotency check via findInvoiceByReference if supported
    const existing = await this.findInvoiceByReference(transport, request.referenceCode, companyId);
    if (existing) {
      return OdooResponseMapper.toInvoiceResult(existing, {
        idempotentReplay: true,
      });
    }

    // 2. Create Draft account.move
    const payload = OdooRequestMapper.toOdooInvoice(request, partnerId, {
      journalId: options?.journalId,
      defaultTaxId: options?.defaultTaxId,
    });

    const createRes = await transport.execute<number | number[]>({
      model: 'account.move',
      method: 'create',
      args: transport.kind === 'rpc' ? [payload] : undefined,
      kwargs: transport.kind === 'json2' ? { values: payload } : undefined,
      companyId,
    });

    const moveId = Array.isArray(createRes) ? createRes[0] : (createRes as number);
    if (!moveId) {
      throw new Error("Odoo taslak fatura oluşturulamadı (moveId alınamadı).");
    }

    // 3. Read back draft invoice to capture Odoo-calculated totals
    const draftMoves = await transport.execute<OdooMove[]>({
      model: 'account.move',
      method: 'read',
      args: transport.kind === 'rpc' ? [[moveId]] : undefined,
      kwargs: transport.kind === 'json2' ? { ids: [moveId] } : undefined,
      companyId,
    });

    const draft = draftMoves && draftMoves[0];
    if (!draft) {
      throw new Error(`Odoo taslak faturası okunamadı (ID: ${moveId}).`);
    }

    const odooTotal = Number(draft.amount_total ?? 0);
    const kroptosTotal = Number(request.grandTotal);

    // 4. Reconciliation (§5.4)
    const recon = this.reconcile(kroptosTotal, odooTotal, request.currency);

    if (!recon.matched) {
      // STOP! DO NOT POST. Return Draft result with mismatch metadata
      return OdooResponseMapper.toInvoiceResult(draft, {
        reconciliationMismatch: true,
        reconciliationDiff: recon.diff,
        reconciliationMessage: recon.reason,
        odooTotal: recon.odooTotal,
        kroptosTotal: recon.kroptosTotal,
      });
    }

    // 5. Totals match: post the invoice via action_post
    await transport.execute({
      model: 'account.move',
      method: 'action_post',
      args: transport.kind === 'rpc' ? [[moveId]] : undefined,
      kwargs: transport.kind === 'json2' ? { ids: [moveId] } : undefined,
      companyId,
    });

    // 6. Read back posted invoice to capture final document number (INV/...) and status
    const postedMoves = await transport.execute<OdooMove[]>({
      model: 'account.move',
      method: 'read',
      args: transport.kind === 'rpc' ? [[moveId]] : undefined,
      kwargs: transport.kind === 'json2' ? { ids: [moveId] } : undefined,
      companyId,
    });

    const posted = (postedMoves && postedMoves[0]) || { ...draft, state: 'posted' as const };

    return OdooResponseMapper.toInvoiceResult(posted, {
      reconciliationMatched: true,
      posted: true,
    });
  }

  /**
   * Find invoice by referenceCode (§5.6)
   */
  static async findInvoiceByReference(
    transport: IOdooTransport,
    referenceCode: string,
    companyId?: number | string,
  ): Promise<OdooMove | null> {
    if (!referenceCode) return null;

    const domain = [
      ['ref', '=', referenceCode],
      ['move_type', '=', 'out_invoice'],
    ];

    const moves = await transport.execute<OdooMove[]>({
      model: 'account.move',
      method: 'search_read',
      args: transport.kind === 'rpc' ? [domain] : undefined,
      kwargs:
        transport.kind === 'json2'
          ? { domain, limit: 1 }
          : { domain, limit: 1 },
      companyId,
    });

    return moves && moves.length > 0 ? moves[0] : null;
  }

  /**
   * Cancel invoice flow (§5.5, §8.14)
   * Must read current state first:
   * - Draft -> button_cancel
   * - Posted -> Reversal (credit note) requires verified documentation
   */
  static async executeCancelInvoice(
    transport: IOdooTransport,
    externalId: string,
    companyId?: number | string,
  ): Promise<{ cancellationType: 'deleted' | 'credit_memo' | 'cancelled'; message: string }> {
    const moveId = parseInt(externalId, 10);
    if (isNaN(moveId)) {
      throw new Error(`Geçersiz Odoo fatura kimliği: ${externalId}`);
    }

    // Step 1: Read current status from Odoo (universal conformance rule 18)
    const moves = await transport.execute<OdooMove[]>({
      model: 'account.move',
      method: 'read',
      args: transport.kind === 'rpc' ? [[moveId]] : undefined,
      kwargs: transport.kind === 'json2' ? { ids: [moveId] } : undefined,
      companyId,
    });

    const move = moves && moves[0];
    if (!move) {
      throw new Error(`Odoo faturası bulunamadı (ID: ${externalId}).`);
    }

    if (move.state === 'cancel') {
      throw new Error(`Odoo faturası (${externalId}) zaten iptal edilmiştir.`);
    }

    if (move.state === 'draft') {
      // Draft -> cancel directly via button_cancel
      await transport.execute({
        model: 'account.move',
        method: 'button_cancel',
        args: transport.kind === 'rpc' ? [[moveId]] : undefined,
        kwargs: transport.kind === 'json2' ? { ids: [moveId] } : undefined,
        companyId,
      });

      return {
        cancellationType: 'cancelled',
        message: 'Odoo taslak faturası başarıyla iptal edildi.',
      };
    }

    // Posted invoice reversal (§5.5):
    // Reversal flow in live Odoo requires account.move.reversal wizard and is DOCUMENTATION_REQUIRED
    throw new IntegrationNotVerifiedError(
      'odoo',
      "Odoo üzerinde kaydedilmiş (posted) faturaların iptali alacak dekontu (ters kayıt) gerektirir. Canlı ters kayıt yöntemi henüz doğrulanmamıştır (DOCUMENTATION_REQUIRED).",
    );
  }
}
