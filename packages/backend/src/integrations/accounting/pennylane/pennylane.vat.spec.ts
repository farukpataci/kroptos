import { PennylaneVatMapper } from './pennylane.vat';

describe('PennylaneVatMapper (§5.4, §9.5)', () => {
  it('Fransa standart KDV oranlarını doğru kodlara eşlemeli', () => {
    expect(PennylaneVatMapper.mapRateToCode(20)).toBe('FR_200');
    expect(PennylaneVatMapper.mapRateToCode('20')).toBe('FR_200');
    expect(PennylaneVatMapper.mapRateToCode(10)).toBe('FR_100');
    expect(PennylaneVatMapper.mapRateToCode('10')).toBe('FR_100');
    expect(PennylaneVatMapper.mapRateToCode(5.5)).toBe('FR_055');
    expect(PennylaneVatMapper.mapRateToCode('5.5')).toBe('FR_055');
    expect(PennylaneVatMapper.mapRateToCode(2.1)).toBe('FR_021');
    expect(PennylaneVatMapper.mapRateToCode(0)).toBe('exempt');
  });

  it('kod doğrudan verildiğinde aynen kabul etmeli', () => {
    expect(PennylaneVatMapper.mapRateToCode('FR_200')).toBe('FR_200');
    expect(PennylaneVatMapper.mapRateToCode('FR_055')).toBe('FR_055');
    expect(PennylaneVatMapper.mapRateToCode('exempt')).toBe('exempt');
  });

  it('eşleşmeyen oranda ASLA kod uydurmamalı, açık hata fırlatmalı (§9.5)', () => {
    expect(() => PennylaneVatMapper.mapRateToCode(18)).toThrow(
      'Pennylane KDV eşleme hatası',
    );
    expect(() => PennylaneVatMapper.mapRateToCode(8)).toThrow(
      'Pennylane KDV eşleme hatası',
    );
    expect(() => PennylaneVatMapper.mapRateToCode(19)).toThrow(
      'Pennylane KDV eşleme hatası',
    );
    expect(() => PennylaneVatMapper.mapRateToCode('unknown_rate')).toThrow(
      'Pennylane KDV eşleme hatası',
    );
  });

  it('isSupported metodunu doğru çalıştırmalı', () => {
    expect(PennylaneVatMapper.isSupported(20)).toBe(true);
    expect(PennylaneVatMapper.isSupported(5.5)).toBe(true);
    expect(PennylaneVatMapper.isSupported(18)).toBe(false);
  });
});
