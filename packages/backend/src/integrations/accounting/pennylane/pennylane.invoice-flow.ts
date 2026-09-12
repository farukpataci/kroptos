import { Logger } from '@nestjs/common';
import {
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
} from '../core/AccountingTypes';
import { IPennylaneClient } from './pennylane.client';
import { PennylaneRequestMapper } from './pennylane.request-mapper';
import { PennylaneResponseMapper } from './pennylane.response-mapper';
import { PennylaneReconciliationResult } from './pennylane.types';

/**
 * Pennylane Fatura Yaşam Döngüsü Orkestrasyonu (§5.1, §9.1, §9.2)
 *
 * KRİTİK YAŞAM DÖNGÜSÜ:
 * 1. Claim satırı (idempotency - çağırıcı tarafından korunur)
 * 2. POST /customer_invoices -> draft: true (ZORUNLU! §5.1)
 * 3. Geri oku -> Sunucu hesaplamalı toplamları al
 * 4. MUTABAKAT: Toplam ≟ KroptOS sipariş toplamı (tolerans <= 0.05 EUR)
 *    - Eşleşirse: PUT /customer_invoices/{id}/finalize ile kesinleştir
 *    - Uyuşmazlık varsa: KESİNLEŞTİRME! Fatura taslakta bekletilir, uyuşmazlık bayrağı atanır.
 */
export class PennylaneInvoiceFlow {
  private static readonly logger = new Logger(PennylaneInvoiceFlow.name);

  static reconcile(
    kroptosTotal: number,
    pennylaneTotal: number,
    currency = 'EUR',
  ): PennylaneReconciliationResult {
    const diff = Math.abs(pennylaneTotal - kroptosTotal);
    const matched = diff <= 0.05;

    return {
      matched,
      kroptosTotal,
      pennylaneTotal,
      diff: Number(diff.toFixed(2)),
      currency,
      reason: matched
        ? undefined
        : `Pennylane toplamı (${pennylaneTotal.toFixed(2)} ${currency}) KroptOS toplamıyla (${kroptosTotal.toFixed(2)} ${currency}) uyuşmuyor: fark ${diff.toFixed(2)} ${currency}. Fatura taslakta bırakıldı, kesinleştirilmedi (§5.1).`,
    };
  }

  static async executeCreateInvoice(
    client: IPennylaneClient,
    request: AccountingInvoiceRequest,
    customerId: number,
  ): Promise<AccountingInvoiceResult> {
    // 1. Taslak Fatura Oluşturma (draft: true ZORUNLUDUR §5.1, §9.1)
    const draftPayload = PennylaneRequestMapper.toCreateInvoice(request, {
      customerId,
      externalReference: request.referenceCode,
    });

    if (draftPayload.draft !== true) {
      throw new Error(
        "Güvenlik kuralı ihlali: Pennylane faturası oluşturulurken 'draft: true' zorunludur!",
      );
    }

    const createdDraft = await client.createInvoice(draftPayload);

    // 2. Sunucu Hesaplamalı Toplamları Geri Okuma
    const readBack = await client.getInvoice(createdDraft.id);

    const pennylaneTotal = parseFloat(
      readBack.currency_amount || readBack.amount || '0',
    );
    const kroptosTotal = request.grandTotal;

    // 3. Mutabakat Kontrolü (Tolerans <= 0.05)
    const reconciliation = this.reconcile(kroptosTotal, pennylaneTotal, request.currency);

    if (reconciliation.matched) {
      // 4. Kesinleştirme: PUT /customer_invoices/{id}/finalize (§2.5 a, §5.1)
      const finalized = await client.finalizeInvoice(createdDraft.id);
      return PennylaneResponseMapper.toInvoiceResult(finalized, false);
    } else {
      // Uyuşmazlık: Kesinleştirilmez, taslakta bırakılır (§5.1, §9.2)
      this.logger.warn(
        `[PennylaneInvoiceFlow] ${reconciliation.reason}`,
      );
      return PennylaneResponseMapper.toInvoiceResult(readBack, true);
    }
  }
}
