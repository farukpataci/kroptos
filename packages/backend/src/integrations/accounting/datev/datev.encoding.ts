import { DatevEncoding } from './datev.types';

export class DatevEncodingError extends Error {
  constructor(
    public readonly unencodableChar: string,
    public readonly codePoint: number,
    public readonly lineOrRecord?: string | number,
    message?: string,
  ) {
    super(
      message ||
        `DATEV Kodlama Hatası: '${unencodableChar}' (U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}) karakteri WINDOWS-1252 kodlamasında desteklenmemektedir (Kayıt/Satır: ${lineOrRecord ?? 'belirsiz'}).`,
    );
    this.name = 'DatevEncodingError';
  }
}

/**
 * Windows-1252 code points mapping for 0x80 - 0x9F range
 */
const CP1252_EXTRA_MAP: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

export class DatevEncodingService {
  /**
   * Encodes a string to the desired DATEV encoding.
   * If WINDOWS-1252 is chosen, verifies that every single character is representable.
   * Throws DatevEncodingError on any non-representable character.
   */
  static encode(
    text: string,
    encoding: DatevEncoding = 'WINDOWS-1252',
    recordInfo?: string | number,
  ): Buffer {
    if (encoding === 'UTF-8') {
      return Buffer.from(text, 'utf8');
    }

    const bytes: number[] = [];

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);

      if (code <= 0x7f) {
        // ASCII range
        bytes.push(code);
      } else if (code >= 0xa0 && code <= 0xff) {
        // Latin-1 Supplement range (ä, ö, ü, ß, Ä, Ö, Ü, etc.)
        bytes.push(code);
      } else if (CP1252_EXTRA_MAP[code] !== undefined) {
        // Windows-1252 extensions (e.g. €)
        bytes.push(CP1252_EXTRA_MAP[code]);
      } else {
        // Character cannot be represented in Windows-1252
        const char = text.charAt(i);
        throw new DatevEncodingError(char, code, recordInfo);
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Decodes a buffer back to string according to the given encoding.
   */
  static decode(buffer: Buffer, encoding: DatevEncoding = 'WINDOWS-1252'): string {
    if (encoding === 'UTF-8') {
      return buffer.toString('utf8');
    }

    // Windows-1252 decoder
    let result = '';
    const reverseExtraMap: Record<number, string> = {};
    for (const [uni, byteVal] of Object.entries(CP1252_EXTRA_MAP)) {
      reverseExtraMap[byteVal] = String.fromCharCode(Number(uni));
    }

    for (let i = 0; i < buffer.length; i++) {
      const b = buffer[i];
      if (b <= 0x7f || (b >= 0xa0 && b <= 0xff)) {
        result += String.fromCharCode(b);
      } else if (reverseExtraMap[b]) {
        result += reverseExtraMap[b];
      } else {
        result += '?';
      }
    }

    return result;
  }
}
