import { AccountingDocumentStatus } from '../core/AccountingTypes';

export class CegidStatusMapper {
  /**
   * Cegid XRP Flex fatura durumunu standart KroptOS AccountingDocumentStatus'e eşler (§5, §7).
   * Muhafazakâr kural: Bilinmeyen veya tanımsız her durum 'pending' olarak eşlenir. Asla 'created' veya 'cancelled' atanmaz.
   */
  static toAccountingDocumentStatus(
    status?: string | null,
  ): AccountingDocumentStatus {
    if (!status) return 'pending';

    const normalized = String(status).trim().toLowerCase();

    switch (normalized) {
      case 'open':
      case 'closed':
        return 'created';
      case 'voided':
      case 'cancelled':
        return 'cancelled';
      case 'hold':
      case 'balanced':
      case 'scheduled':
      case 'pendingprint':
      case 'pendingemail':
        return 'pending';
      default:
        return 'pending';
    }
  }

  /**
   * Evrensel Uygunluk Kuralı (§5, Conformance #18):
   * İptal edilebilir faturalarda, yol seçilmeden önce güncel durum okunur.
   * - 'Hold' veya 'Balanced' durumundaki taslaklar doğrudan iptal edilebilir/silinebilir.
   * - 'Open' veya 'Closed' durumundaki kesinleşmiş belgeler ters kayıt / alacak dekontu gerektirir.
   */
  static canDeleteDirectly(status?: string | null): boolean {
    if (!status) return false;
    const normalized = String(status).trim().toLowerCase();
    return normalized === 'hold' || normalized === 'balanced';
  }

  static determineCancellationPath(
    status?: string | null,
  ): 'void' | 'credit_note' {
    if (!status) return 'void';
    const normalized = String(status).trim().toLowerCase();
    if (normalized === 'closed') return 'credit_note';
    return 'void';
  }
}
