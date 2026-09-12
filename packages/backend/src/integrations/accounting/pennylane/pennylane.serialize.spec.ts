import { PennylaneSerializer } from './pennylane.serialize';

describe('PennylaneSerializer (§5.2, §9.3, §9.4)', () => {
  it('parasal tutarları iki ondalıklı string olarak biçimlendirmeli', () => {
    expect(PennylaneSerializer.formatMonetary(100)).toBe('100.00');
    expect(PennylaneSerializer.formatMonetary(12.3)).toBe('12.30');
    expect(PennylaneSerializer.formatMonetary(99.99)).toBe('99.99');
    expect(PennylaneSerializer.formatMonetary('45.67')).toBe('45.67');
    expect(PennylaneSerializer.formatMonetary(0)).toBe('0.00');
  });

  it('yuvarlamayı iki ondalık hassasiyetinde doğru yapmalı', () => {
    expect(PennylaneSerializer.formatMonetary(10.555)).toBe('10.56');
    expect(PennylaneSerializer.formatMonetary(10.554)).toBe('10.55');
  });

  it('geçersiz sayı verildiğinde hata fırlatmalı', () => {
    expect(() => PennylaneSerializer.formatMonetary('gecersiz')).toThrow(
      'Geçersiz parasal değer',
    );
    expect(() => PennylaneSerializer.formatMonetary(NaN)).toThrow(
      'Geçersiz parasal değer',
    );
    expect(() => PennylaneSerializer.formatMonetary(Infinity)).toThrow(
      'Geçersiz parasal değer',
    );
  });

  it('miktar alanını doğru biçimlendirmeli', () => {
    expect(PennylaneSerializer.formatQuantity(2)).toBe('2.00');
    expect(PennylaneSerializer.formatQuantity(2.5)).toBe('2.50');
    expect(PennylaneSerializer.formatQuantity('3')).toBe('3.00');
  });

  it('raw_currency_unit_price number tipinde ise assertLinePriceIsString hata fırlatmalı (§9.3)', () => {
    expect(() =>
      PennylaneSerializer.assertLinePriceIsString({
        raw_currency_unit_price: 100.0 as any,
      }),
    ).toThrow("raw_currency_unit_price 'string' tipinde olmalıdır");
  });

  it('raw_currency_unit_price string tipinde ise assertLinePriceIsString başarılı olmalı', () => {
    expect(() =>
      PennylaneSerializer.assertLinePriceIsString({
        raw_currency_unit_price: '100.00',
      }),
    ).not.toThrow();
  });
});
