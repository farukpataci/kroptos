import { DatevEncodingService, DatevEncodingError } from './datev.encoding';

describe('DatevEncodingService (§5.7)', () => {
  it('encodes standard German text with umlauts into Windows-1252', () => {
    const germanText = 'Müller & Söhne GmbH - Erlöse 19% MwSt. Großhandel, Köln';
    const buf = DatevEncodingService.encode(germanText, 'WINDOWS-1252');

    expect(buf).toBeDefined();
    expect(buf.length).toBe(germanText.length);

    const decoded = DatevEncodingService.decode(buf, 'WINDOWS-1252');
    expect(decoded).toBe(germanText);
  });

  it('correctly maps Euro symbol (€) to 0x80 in Windows-1252', () => {
    const euroText = 'Rechnung 100 €';
    const buf = DatevEncodingService.encode(euroText, 'WINDOWS-1252');

    expect(buf[buf.length - 1]).toBe(0x80);
    expect(DatevEncodingService.decode(buf, 'WINDOWS-1252')).toBe(euroText);
  });

  it('encodes UTF-8 properly when selected', () => {
    const text = 'KroptOS e.K. Zürich';
    const buf = DatevEncodingService.encode(text, 'UTF-8');
    expect(buf.toString('utf8')).toBe(text);
  });

  it('throws DatevEncodingError with exact character and record info on unencodable character', () => {
    const textWithCyrillic = 'Rechnung für Иван';
    expect(() => {
      DatevEncodingService.encode(textWithCyrillic, 'WINDOWS-1252', 'REC-101');
    }).toThrow(DatevEncodingError);

    try {
      DatevEncodingService.encode(textWithCyrillic, 'WINDOWS-1252', 'REC-101');
    } catch (err: any) {
      expect(err.unencodableChar).toBe('И');
      expect(err.codePoint).toBe(0x0418);
      expect(err.lineOrRecord).toBe('REC-101');
      expect(err.message).toContain("DATEV Kodlama Hatası: 'И' (U+0418)");
    }
  });
});
