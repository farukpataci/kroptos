import { AccountingDocumentStatus } from '../core/AccountingTypes';

export type PennylaneCancellationPath = 'DIRECT_DELETE' | 'CREDIT_NOTE_REQUIRED';

/**
 * Pennylane Durum ve İptal Yolu Eşleyicisi (§7, §9.14, Conformance Rule #18)
 *
 * KRİTİK KURAL:
 * 1. Bilinmeyen durumlar ASLA 'created' veya 'cancelled' yapılmaz; muhafazakâr biçimde 'pending'e düşer.
 * 2. Conformance Rule #18: İptal öncesi mevcut durum okunmalıdır:
 *    - draft: true ise DIRECT_DELETE (DELETE /customer_invoices/{id})
 *    - draft: false (kesinleşmiş) ise CREDIT_NOTE_REQUIRED (alacak dekontu / ters kayıt)
 */
export class PennylaneStatusMapper {
  static toAccountingDocumentStatus(
    rawStatus?: string | null,
    draft?: boolean,
  ): AccountingDocumentStatus {
    if (draft === true) {
      return 'pending';
    }

    if (!rawStatus) {
      return 'pending';
    }

    const s = String(rawStatus).toLowerCase().trim();

    if (s === 'draft') {
      return 'pending';
    }

    if (
      s === 'paid' ||
      s === 'finalized' ||
      s === 'sent' ||
      s === 'unpaid' ||
      s === 'pending_payment' ||
      s === 'overdue' ||
      s === 'issued'
    ) {
      return 'created';
    }

    if (s === 'cancelled' || s === 'canceled' || s === 'void' || s === 'credit_note') {
      return 'cancelled';
    }

    // Bilinmeyen tüm durumlarda güvenli muhafazakâr geri dönüş (§7, §9.14)
    return 'pending';
  }

  static toKroptosStatus(
    rawStatus?: string | null,
    draft?: boolean,
  ): AccountingDocumentStatus {
    return this.toAccountingDocumentStatus(rawStatus, draft);
  }

  /**
   * Conformance Rule #18: Taslak halindeki faturalar doğrudan silinebilir;
   * kesinleşmiş faturalar ise kalıcı yasal belge olduğu için alacak dekontu gerektirir.
   */
  static canDeleteDirectly(draft: boolean): boolean {
    return draft === true;
  }

  static determineCancellationPath(draft: boolean): PennylaneCancellationPath {
    if (this.canDeleteDirectly(draft)) {
      return 'DIRECT_DELETE';
    }
    return 'CREDIT_NOTE_REQUIRED';
  }
}
