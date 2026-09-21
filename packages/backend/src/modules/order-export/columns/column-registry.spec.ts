import { escapeFormula, getAvailableColumns, COLUMNS_MAP } from './column-registry';

describe('ColumnRegistry & Formula Injection Protection', () => {
  describe('escapeFormula', () => {
    it('should prefix values starting with = with a single quote', () => {
      expect(escapeFormula('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    });

    it('should prefix values starting with +, -, @, \\t, \\r with a single quote', () => {
      expect(escapeFormula('+cmd|')).toBe("'+cmd|");
      expect(escapeFormula('-cmd|')).toBe("'-cmd|");
      expect(escapeFormula('@sum')).toBe("'@sum");
      expect(escapeFormula('\tcmd')).toBe("'\tcmd");
      expect(escapeFormula('\rcmd')).toBe("'\rcmd");
    });

    it('should leave normal strings unchanged', () => {
      expect(escapeFormula('Normal Order Text')).toBe('Normal Order Text');
      expect(escapeFormula('12345')).toBe('12345');
    });

    it('should handle non-strings safely', () => {
      expect(escapeFormula(null)).toBeNull();
      expect(escapeFormula(undefined)).toBeUndefined();
      expect(escapeFormula(123)).toBe(123);
    });
  });

  describe('getAvailableColumns', () => {
    it('should filter out PII columns when canPii is false', () => {
      const withoutPii = getAvailableColumns(false, 'ORDER');
      const hasPii = withoutPii.some((c) => c.pii);
      expect(hasPii).toBe(false);
    });

    it('should include PII columns when canPii is true', () => {
      const withPii = getAvailableColumns(true, 'ORDER');
      const hasCustomerPhone = withPii.some((c) => c.key === 'customerPhone');
      expect(hasCustomerPhone).toBe(true);
    });

    it('should filter columns by rowMode', () => {
      const orderModeCols = getAvailableColumns(true, 'ORDER');
      const lineItemCols = getAvailableColumns(true, 'LINE_ITEM');

      expect(orderModeCols.some((c) => c.key === 'itemName')).toBe(false);
      expect(lineItemCols.some((c) => c.key === 'itemName')).toBe(true);
    });
  });

  describe('COLUMNS_MAP resolution', () => {
    it('should resolve order number correctly', () => {
      const orderNumberCol = COLUMNS_MAP.get('orderNumber');
      expect(orderNumberCol).toBeDefined();

      const mockOrder = { orderNumber: 'ORD-2026-001' };
      expect(orderNumberCol!.resolve(mockOrder)).toBe('ORD-2026-001');
    });

    it('should resolve item columns correctly', () => {
      const itemSkuCol = COLUMNS_MAP.get('itemSku');
      expect(itemSkuCol).toBeDefined();

      const mockItem = { sku: 'TEST-SKU-123' };
      expect(itemSkuCol!.resolve({}, mockItem)).toBe('TEST-SKU-123');
    });
  });
});
