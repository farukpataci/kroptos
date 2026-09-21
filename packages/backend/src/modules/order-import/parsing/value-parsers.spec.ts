import { ValueParsers } from './value-parsers';
import { AutoMapper } from '../mapping/auto-mapper';

describe('OrderImport ValueParsers', () => {
  describe('parseDate', () => {
    it('should parse Turkish date format dd.MM.yyyy', () => {
      const d = ValueParsers.parseDate('21.09.2026');
      expect(d).toBeInstanceOf(Date);
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(8); // 0-indexed: 8 is September
      expect(d?.getDate()).toBe(21);
    });

    it('should parse Turkish date format with time dd.MM.yyyy HH:mm', () => {
      const d = ValueParsers.parseDate('21.09.2026 14:35');
      expect(d).toBeInstanceOf(Date);
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getHours()).toBe(14);
      expect(d?.getMinutes()).toBe(35);
    });

    it('should parse ISO 8601 dates', () => {
      const d = ValueParsers.parseDate('2026-09-21T10:00:00Z');
      expect(d).toBeInstanceOf(Date);
      expect(d?.toISOString()).toContain('2026-09-21');
    });

    it('should parse Excel serial date numbers', () => {
      // 45367 ~ March 2024
      const d = ValueParsers.parseDate(45367);
      expect(d).toBeInstanceOf(Date);
      expect(d?.getFullYear()).toBe(2024);
    });

    it('should return null for invalid date string', () => {
      expect(ValueParsers.parseDate('invalid-date')).toBeNull();
      expect(ValueParsers.parseDate('')).toBeNull();
    });
  });

  describe('parseNumber', () => {
    it('should parse Turkish decimal format 1.234,56', () => {
      const n = ValueParsers.parseNumber('1.234,56');
      expect(n).toBe(1234.56);
    });

    it('should parse standard decimal format 1,234.56', () => {
      const n = ValueParsers.parseNumber('1,234.56');
      expect(n).toBe(1234.56);
    });

    it('should strip Turkish Lira currency symbols', () => {
      expect(ValueParsers.parseNumber('₺ 1.250,00')).toBe(1250);
      expect(ValueParsers.parseNumber('1.250,00 TL')).toBe(1250);
      expect(ValueParsers.parseNumber('500 TRY')).toBe(500);
    });

    it('should handle pure numbers and decimals', () => {
      expect(ValueParsers.parseNumber(99.9)).toBe(99.9);
      expect(ValueParsers.parseNumber('42')).toBe(42);
    });
  });

  describe('parsePhone', () => {
    it('should normalize Turkish 10-digit number 5551234567 to +905551234567', () => {
      const res = ValueParsers.parsePhone('555 123 45 67');
      expect(res.phone).toBe('+905551234567');
      expect(res.warning).toBeUndefined();
    });

    it('should normalize Turkish 11-digit number with leading 0', () => {
      const res = ValueParsers.parsePhone('0532-987-6543');
      expect(res.phone).toBe('+905329876543');
      expect(res.warning).toBeUndefined();
    });

    it('should normalize number starting with 905', () => {
      const res = ValueParsers.parsePhone('905321112233');
      expect(res.phone).toBe('+905321112233');
    });
  });

  describe('parseBoolean', () => {
    it('should parse Turkish evet/hayır and true/false', () => {
      expect(ValueParsers.parseBoolean('evet')).toBe(true);
      expect(ValueParsers.parseBoolean('Evet')).toBe(true);
      expect(ValueParsers.parseBoolean('hayır')).toBe(false);
      expect(ValueParsers.parseBoolean('hayir')).toBe(false);
      expect(ValueParsers.parseBoolean('1')).toBe(true);
      expect(ValueParsers.parseBoolean('0')).toBe(false);
    });
  });

  describe('AutoMapper', () => {
    it('should map Turkish and English headers to canonical keys', () => {
      const headers = [
        'Sipariş No',
        'Müşteri Adı',
        'E-Posta',
        'Telefon',
        'Teslimat Adresi',
        'İlçe',
        'Şehir',
        'Kargo Firması',
        'Kargo Takip No',
        'Toplam Tutar',
        'Stok Kodu',
        'Adet',
        'Birim Fiyat',
      ];

      const result = AutoMapper.mapHeaders(headers);

      expect(result.columnMap['Sipariş No']).toBe('orderNumber');
      expect(result.columnMap['Müşteri Adı']).toBe('customerName');
      expect(result.columnMap['E-Posta']).toBe('customerEmail');
      expect(result.columnMap['Telefon']).toBe('customerPhone');
      expect(result.columnMap['Teslimat Adresi']).toBe('shippingLine1');
      expect(result.columnMap['İlçe']).toBe('shippingDistrict');
      expect(result.columnMap['Şehir']).toBe('shippingCity');
      expect(result.columnMap['Kargo Firması']).toBe('carrierName');
      expect(result.columnMap['Kargo Takip No']).toBe('trackingNumber');
      expect(result.columnMap['Toplam Tutar']).toBe('totalAmount');
      expect(result.columnMap['Stok Kodu']).toBe('itemSku');
      expect(result.columnMap['Adet']).toBe('itemQuantity');
      expect(result.columnMap['Birim Fiyat']).toBe('itemUnitPrice');
    });
  });
});
