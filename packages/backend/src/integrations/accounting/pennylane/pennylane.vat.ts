import { PennylaneVatRateCode } from './pennylane.types';

/**
 * Pennylane KDV Eşleme Modülü (§5.4, §9.5)
 *
 * KRİTİK KURAL:
 * Pennylane API v2, KDV oranını sayı olarak değil, Fransa vergi sistemi kodlu enum (`vat_rate`) olarak bekler.
 * Fransa dışı oran tanımlı değildir. KroptOS oranı eşlenemezse fatura GÖNDERİLMEZ ve açık hata fırlatılır.
 */
export class PennylaneVatMapper {
  private static readonly RATE_MAP: Record<string, PennylaneVatRateCode> = {
    '20': 'FR_200',
    '20.0': 'FR_200',
    '20.00': 'FR_200',
    '10': 'FR_100',
    '10.0': 'FR_100',
    '10.00': 'FR_100',
    '5.5': 'FR_055',
    '5.50': 'FR_055',
    '2.1': 'FR_021',
    '2.10': 'FR_021',
    '0': 'exempt',
    '0.0': 'exempt',
    '0.00': 'exempt',
  };

  /**
   * Yüzdesel KDV oranını (örn: 20, 10, 5.5, 0) Pennylane vat_rate koduna eşler.
   * Eşleşmeyen oranlarda ASLA kod uydurmaz, hata fırlatır (§5.4, §9.5).
   */
  static mapRateToCode(taxRatePercent: number | string | undefined | null): PennylaneVatRateCode {
    if (taxRatePercent === undefined || taxRatePercent === null) {
      return 'FR_200'; // Fransa standart KDV varsayılanı
    }

    const rateStr = String(taxRatePercent).trim();

    // Doğrudan geçerli bir kod verilmişse
    if (rateStr === 'FR_200' || rateStr === 'FR_100' || rateStr === 'FR_055' || rateStr === 'FR_021' || rateStr === 'exempt') {
      return rateStr as PennylaneVatRateCode;
    }

    const matched = this.RATE_MAP[rateStr];
    if (matched) {
      return matched;
    }

    // Sayısal dönüştürme kontrolü
    const num = parseFloat(rateStr);
    if (!Number.isNaN(num)) {
      if (Math.abs(num - 20) < 0.01) return 'FR_200';
      if (Math.abs(num - 10) < 0.01) return 'FR_100';
      if (Math.abs(num - 5.5) < 0.01) return 'FR_055';
      if (Math.abs(num - 2.1) < 0.01) return 'FR_021';
      if (Math.abs(num - 0) < 0.01) return 'exempt';
    }

    throw new Error(
      `Pennylane KDV eşleme hatası (§5.4): KroptOS KDV oranı (%${taxRatePercent}) geçerli bir Pennylane Fransa KDV koduna (FR_200, FR_100, FR_055, FR_021, exempt) eşlenemedi. Eşleşmeyen vergi oranıyla fatura gönderilemez.`,
    );
  }

  /**
   * Belirtilen oranın Pennylane tarafından desteklenip desteklenmediğini kontrol eder.
   */
  static isSupported(taxRatePercent: number | string): boolean {
    try {
      this.mapRateToCode(taxRatePercent);
      return true;
    } catch {
      return false;
    }
  }
}
