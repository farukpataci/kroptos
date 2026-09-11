import { BadRequestException } from '@nestjs/common';

export type KroptosDocumentStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

/**
 * NetSuite Fatura Durum Eşleyicisi (§6)
 *
 * KRİTİK İLKELER:
 * 1. Muhafazakâr yaklaşım: NetSuite durumları tam doğrulanmadığı için, BİLİNMEYEN HER ŞEY 'pending' olarak eşlenir.
 * 2. Bilinmeyen bir durum ASLA 'sent' veya 'cancelled' durumuna düşürülmez.
 * 3. İptal öncesinde faturanın güncel durumu mutlaka okunur (9. uygunluk kuralı uygulaması).
 */
export class NetSuiteStatusMapper {
  /**
   * NetSuite durum metnini KroptOS Belge Durumuna eşler.
   */
  static toKroptosStatus(netsuiteStatus?: string | null): KroptosDocumentStatus {
    if (!netsuiteStatus || typeof netsuiteStatus !== 'string') {
      return 'pending';
    }

    const normalized = netsuiteStatus.trim().toLowerCase();

    switch (normalized) {
      // Beklemede / Taslak durumları
      case 'draft':
      case 'pending approval':
      case 'pending_approval':
      case 'pendingapproval':
      case 'open - pending approval':
      case 'rejected':
        return 'pending';

      // Muhasebeleştirilmiş / Kesinleşmiş / Ödenmiş durumları
      case 'open':
      case 'paid in full':
      case 'paid_in_full':
      case 'paid':
      case 'partially paid':
      case 'partiallypaid':
        return 'sent';

      // İptal edilmiş durumlar
      case 'voided':
      case 'cancelled':
      case 'canceled':
        return 'cancelled';

      default:
        // §6: Bilinmeyen veya belirsiz her durum kesinlikle 'pending' döner!
        return 'pending';
    }
  }

  /**
   * İptal öncesi geçiş kontrolü (§6)
   * NetSuite'te tamamen ödenmiş faturalar doğrudan iptal edilemez (Credit Memo / iade gerektirir).
   */
  static validateCancellationTransition(currentStatus?: string | null): {
    canCancel: boolean;
    alreadyCancelled: boolean;
    reason?: string;
  } {
    if (!currentStatus) {
      // Durum bilinmiyorsa iptal işlemine doğrudan izin verilmez; önce okunmalıdır.
      return {
        canCancel: false,
        alreadyCancelled: false,
        reason: 'Faturanın NetSuite üzerindeki güncel durumu okunamadı.',
      };
    }

    const normalized = currentStatus.trim().toLowerCase();

    if (normalized === 'voided' || normalized === 'cancelled' || normalized === 'canceled') {
      return {
        canCancel: false,
        alreadyCancelled: true,
        reason: 'Fatura zaten iptal edilmiş veya hükümsüz (voided) durumdadır.',
      };
    }

    if (normalized === 'paid in full' || normalized === 'paid_in_full' || normalized === 'paid') {
      return {
        canCancel: false,
        alreadyCancelled: false,
        reason: 'Tamamı ödenmiş NetSuite faturaları doğrudan iptal edilemez; Credit Memo (Alacak Dekontu) kesilmelidir.',
      };
    }

    return {
      canCancel: true,
      alreadyCancelled: false,
    };
  }
}
