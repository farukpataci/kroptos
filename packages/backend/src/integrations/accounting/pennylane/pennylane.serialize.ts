/**
 * Pennylane Serializer (§5.2, §9.3, §9.4)
 *
 * KRİTİK MİMARİ KURALI:
 * Pennylane API v2, ondalıklı parasal değerlerin (raw_currency_unit_price, price_before_tax vb.)
 * JSON içinde NUMBER olarak değil, STRING olarak ("100.00") gönderilmesini şart koşar.
 * Tüm parasal ve ondalıklı alan serileştirmesi TEK BİR YERDEN, bu modülden geçer.
 */
export class PennylaneSerializer {
  /**
   * Parasal tutarı iki ondalık basamaklı geçerli bir string'e çevirir (örn. 100 -> "100.00", 12.345 -> "12.35").
   */
  static formatMonetary(value: number | string | undefined | null): string {
    if (value === undefined || value === null) {
      return '0.00';
    }

    const num = typeof value === 'number' ? value : parseFloat(String(value));

    if (Number.isNaN(num) || !Number.isFinite(num)) {
      throw new Error(`Geçersiz parasal değer: ${value}`);
    }

    // İki ondalık basamaklı, nokta ayrımlı standart format
    return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
  }

  /**
   * Miktar değerini geçerli bir string veya sayıya çevirir.
   */
  static formatQuantity(value: number | string | undefined | null): string {
    if (value === undefined || value === null) {
      return '1.00';
    }

    const num = typeof value === 'number' ? value : parseFloat(String(value));

    if (Number.isNaN(num) || !Number.isFinite(num)) {
      throw new Error(`Geçersiz miktar değeri: ${value}`);
    }

    // Tam sayıysa tam sayı biçiminde veya standart 2 ondalıklı
    return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
  }

  /**
   * Gönderilecek satır öğesindeki parasal alanların string olduğunu doğrular (§9.3).
   * Eğer raw_currency_unit_price number ise hata fırlatır.
   */
  static assertLinePriceIsString(line: { raw_currency_unit_price: any }): void {
    if (typeof line.raw_currency_unit_price !== 'string') {
      throw new Error(
        `Pennylane v2 kuralı ihlali (§5.2): raw_currency_unit_price 'string' tipinde olmalıdır, alınan tip: ${typeof line.raw_currency_unit_price}`,
      );
    }
  }
}
