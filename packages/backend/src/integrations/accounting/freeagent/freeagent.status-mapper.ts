import { FreeAgentInvoiceStatus } from './freeagent.types';

export type KroptosDocumentStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'cancel_failed';

export class FreeAgentStatusMapper {
  /**
   * §6 FreeAgent Fatura Durumu -> KroptOS Belge Durumu Eşleme Tablosu:
   *
   * Draft, Scheduled To Email, Zero Value       -> 'pending'
   * Open, Overdue, Paid, Overpaid               -> 'sent'
   * Refunded, Written-off, Part written-off     -> 'sent' (belge muhasebede yaşıyor; iptal DEĞİL!)
   * Cancelled (§5.8 API dönüşünde)              -> 'cancelled'
   * Bilinmeyen veya tanımsız                    -> 'pending' (ASLA 'sent' veya 'cancelled' değil!)
   */
  static toKroptosStatus(freeagentStatus?: FreeAgentInvoiceStatus | string | null): KroptosDocumentStatus {
    if (!freeagentStatus) return 'pending';

    const normalized = freeagentStatus.trim();

    switch (normalized) {
      case 'Draft':
      case 'Scheduled To Email':
      case 'Zero Value':
        return 'pending';

      case 'Open':
      case 'Overdue':
      case 'Paid':
      case 'Overpaid':
        return 'sent';

      case 'Refunded':
      case 'Written-off':
      case 'Part written-off':
        // KRİTİK: Written-off ve Refunded'ı cancelled'a eşleme! Bunlar faturanın iptali değil
        // muhasebesel sonuçlarıdır (§6).
        return 'sent';

      case 'Cancelled':
      case 'marked_as_cancelled':
        return 'cancelled';

      default:
        // Bilinmeyen her durum güvenli kapalı tarafa ('pending') düşer (§6, §8.17)
        return 'pending';
    }
  }

  /**
   * §5.8 Faturanın iptal edilebilirliğini doğrular.
   * Ödenmiş (Paid) faturalar geçişle iptal edilemez, credit note gerektirir.
   */
  static isTransitionAllowed(
    currentStatus?: FreeAgentInvoiceStatus | string,
  ): { allowed: boolean; reason?: string } {
    if (!currentStatus) {
      return { allowed: false, reason: 'Mevcut fatura durumu bilinmiyor.' };
    }

    if (currentStatus === 'Paid' || currentStatus === 'Overpaid') {
      return {
        allowed: false,
        reason:
          'Ödenmiş (Paid/Overpaid) FreeAgent faturaları doğrudan iptal geçişine alınamaz. Resmi muhasebe iptali için Credit Note düzenlenmelidir.',
      };
    }

    if (currentStatus === 'Refunded' || currentStatus === 'Written-off') {
      return {
        allowed: false,
        reason:
          'İade edilmiş (Refunded) veya silinmiş (Written-off) faturalar üzerinde iptal geçişi yapılamaz.',
      };
    }

    return { allowed: true };
  }
}
