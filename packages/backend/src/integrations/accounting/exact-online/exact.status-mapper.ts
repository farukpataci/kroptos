import { AccountingDocumentStatus } from '../core/AccountingTypes';
import { ExactSalesInvoice } from './exact.types';

export class ExactStatusMapper {
  /**
   * Exact Online fatura durumunu KroptOS durumuna eşler (§6).
   * Kural: Bilinen değerler eşlenir, BİLİNMEYEN HER ŞEY 'pending' yapılır;
   * asla bilinmeyen durum 'created' veya 'cancelled' kabul edilmez.
   */
  static toKroptosStatus(
    status?: number,
    type?: number,
  ): AccountingDocumentStatus {
    if (status === undefined || status === null) {
      return 'pending';
    }

    switch (status) {
      case 20: // Open (Açık / Henüz işlenmemiş)
        return 'created';

      case 50: // Processed (İşlenmiş / Kesilmiş)
        return 'created';

      default:
        // Bilinmeyen veya ara durumlar kesinlikle 'pending' döner
        return 'pending';
    }
  }

  /**
   * Faturanın iptal edilebilir olup olmadığını kontrol eder.
   * Yalnızca Status: 20 (Open) olan faturalar doğrudan silinebilir/iptal edilebilir.
   * Status: 50 (Processed) olan faturalar ters fatura (Credit Note - 8021) gerektirir.
   */
  static canCancelDirectly(invoice: ExactSalesInvoice): {
    canCancel: boolean;
    reason?: string;
  } {
    const status = invoice.Status;
    if (status === 20) {
      return { canCancel: true };
    }
    if (status === 50) {
      return {
        canCancel: false,
        reason:
          'İşlenmiş (Processed - 50) Exact Online satış faturaları doğrudan iptal edilemez; muhasebesel ters fatura (Sales Credit Note) düzenlenmelidir.',
      };
    }
    return {
      canCancel: false,
      reason: `Fatura durumu (${status}) doğrudan iptale uygun değildir.`,
    };
  }
}
