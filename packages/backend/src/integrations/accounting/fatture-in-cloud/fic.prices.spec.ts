import {
  computeItemPrice,
  calculateLineItem,
  calculateDocumentTotals,
  roundToTwoDecimals,
} from './fic.prices';

describe('Fatture in Cloud (TeamSystem) Price & Totals Engine (fic.prices.ts)', () => {
  describe('computeItemPrice (§5.4)', () => {
    it('should set net_price and leave gross_price undefined when useGrossPrices is false', () => {
      const result = computeItemPrice({
        unitPrice: 100,
        vatRate: 22,
        useGrossPrices: false,
      });

      expect(result.net_price).toBe(100);
      expect(result.gross_price).toBeUndefined();
      expect(result.computedNetPrice).toBe(100);
      expect(result.computedGrossPrice).toBe(122);
    });

    it('should set gross_price and leave net_price undefined when useGrossPrices is true', () => {
      const result = computeItemPrice({
        unitPrice: 100,
        vatRate: 22,
        useGrossPrices: true,
      });

      expect(result.gross_price).toBe(122);
      expect(result.net_price).toBeUndefined();
      expect(result.computedNetPrice).toBe(100);
      expect(result.computedGrossPrice).toBe(122);
    });

    it('should accurately compute Italian 22% VAT rounding to 2 decimals', () => {
      // 49.99 net * 1.22 = 60.9878 -> 60.99
      const result = computeItemPrice({
        unitPrice: 49.99,
        vatRate: 22,
        useGrossPrices: true,
      });

      expect(result.gross_price).toBe(60.99);
      expect(result.computedNetPrice).toBe(49.99);
      expect(result.computedGrossPrice).toBe(60.99);
    });

    it('should accurately handle 0% VAT (esente/non imponibile)', () => {
      const resultGross = computeItemPrice({
        unitPrice: 150.5,
        vatRate: 0,
        useGrossPrices: true,
      });
      expect(resultGross.gross_price).toBe(150.5);

      const resultNet = computeItemPrice({
        unitPrice: 150.5,
        vatRate: 0,
        useGrossPrices: false,
      });
      expect(resultNet.net_price).toBe(150.5);
    });
  });

  describe('calculateLineItem', () => {
    it('should calculate line item with net price and standard 22% VAT', () => {
      const line = calculateLineItem({
        qty: 2,
        unitPrice: 50,
        vatRate: 22,
        useGrossPrices: false,
      });

      expect(line.qty).toBe(2);
      expect(line.net_price).toBe(50);
      expect(line.gross_price).toBeUndefined();
      expect(line.lineNetAmount).toBe(100);
      expect(line.lineVatAmount).toBe(22);
      expect(line.lineGrossAmount).toBe(122);
    });

    it('should calculate line item with discount applied to net amount', () => {
      // 100 net, qty 1, 10% discount -> 90 net, 22% VAT on 90 = 19.80, gross = 109.80
      const line = calculateLineItem({
        qty: 1,
        unitPrice: 100,
        vatRate: 22,
        discountPercentage: 10,
        useGrossPrices: false,
      });

      expect(line.lineNetAmount).toBe(90);
      expect(line.lineVatAmount).toBe(19.8);
      expect(line.lineGrossAmount).toBe(109.8);
    });

    it('should throw if quantity is zero or negative', () => {
      expect(() =>
        calculateLineItem({
          qty: 0,
          unitPrice: 50,
          vatRate: 22,
        }),
      ).toThrow('Kalem miktarı sıfırdan büyük olmalıdır');
    });
  });

  describe('calculateDocumentTotals (§5.5)', () => {
    it('should compute exact document totals across multiple items', () => {
      const items = [
        { qty: 2, unitPrice: 50, vatRate: 22 }, // net 100, vat 22, gross 122
        { qty: 1, unitPrice: 30, vatRate: 10 }, // net 30, vat 3, gross 33
      ];

      const totals = calculateDocumentTotals(items, false);

      expect(totals.amount_net).toBe(130);
      expect(totals.amount_vat).toBe(25);
      expect(totals.amount_gross).toBe(155);
      expect(totals.items.length).toBe(2);
      expect(totals.items[0].net_price).toBe(50);
      expect(totals.items[1].net_price).toBe(30);
    });

    it('should throw if items list is empty', () => {
      expect(() => calculateDocumentTotals([])).toThrow(
        'Fatura toplamı hesaplamak için en az bir kalem gereklidir',
      );
    });
  });

  describe('roundToTwoDecimals', () => {
    it('rounds numbers correctly', () => {
      expect(roundToTwoDecimals(10.254)).toBe(10.25);
      expect(roundToTwoDecimals(10.255)).toBe(10.26);
      expect(roundToTwoDecimals(10.256)).toBe(10.26);
    });
  });
});
