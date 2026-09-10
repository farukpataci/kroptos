import { QBODocNumber } from './qbo.doc-number';

describe('QBODocNumber (§4.5 & §7.2.13)', () => {
  it('keeps references <= 21 characters unchanged', () => {
    expect(QBODocNumber.format('ORD-12345')).toBe('ORD-12345');
    expect(QBODocNumber.format('123456789012345678901')).toBe('123456789012345678901');
    expect(QBODocNumber.format('123456789012345678901').length).toBe(21);
  });

  it('shortens references > 21 characters to exactly 21 characters deterministically', () => {
    const longRef = 'KROPTOS-AMAZON-ORDER-2026-99998888-EXT';
    const formatted = QBODocNumber.format(longRef);

    expect(formatted.length).toBe(21);
    expect(formatted).toBe(QBODocNumber.format(longRef)); // Deterministic
    expect(formatted.startsWith('KROPTOS-AMAZ')).toBe(true);
    expect(formatted.includes('-')).toBe(true);
  });

  it('handles fallback for empty reference', () => {
    expect(QBODocNumber.format('')).toBe('INV-1');
  });

  it('produces zero collisions across 500 distinct long order references', () => {
    const seen = new Set<string>();
    for (let i = 1; i <= 500; i++) {
      const longRef = `SUPER-LONG-TENANT-ORDER-REF-NUMBER-PREFIX-${i}-SUFFIX-XYZ`;
      const docNum = QBODocNumber.format(longRef);

      expect(docNum.length).toBeLessThanOrEqual(21);
      expect(seen.has(docNum)).toBe(false);
      seen.add(docNum);
    }
    expect(seen.size).toBe(500);
  });
});
