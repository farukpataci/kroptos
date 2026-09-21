/**
 * Value Parsers for Order Import
 * Handles Date, Number/Money, Phone, Boolean, and String normalization
 * per docs/import.md §3.
 */

export interface DateParseOptions {
  dayFirst?: boolean; // Default true for TR (dd.MM.yyyy)
  timezone?: string; // e.g. Europe/Istanbul
}

export interface NumberParseOptions {
  decimalSeparator?: ',' | '.' | 'auto';
}

export class ValueParsers {
  /**
   * Parse Date from string or Excel serial number.
   * Supports: dd.MM.yyyy, dd.MM.yyyy HH:mm[:ss], yyyy-MM-dd, ISO 8601, Excel serial date.
   */
  static parseDate(val: any, options?: DateParseOptions): Date | null {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

    // If it's a number or numeric string representing an Excel serial date (e.g. 45300)
    if (typeof val === 'number' || (/^\d+(\.\d+)?$/.test(String(val).trim()) && Number(val) > 10000 && Number(val) < 100000)) {
      const num = Number(val);
      // Excel base date: Dec 30, 1899 (due to 1900 leap year bug)
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const msPerDay = 86400000;
      const parsed = new Date(excelEpoch.getTime() + num * msPerDay);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    const str = String(val).trim();
    if (!str) return null;

    // ISO format check (e.g. 2026-09-21T14:30:00Z)
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(str)) {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // dd.MM.yyyy [HH:mm[:ss]] or dd/MM/yyyy or dd-MM-yyyy
    const trMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (trMatch) {
      let day = parseInt(trMatch[1], 10);
      let month = parseInt(trMatch[2], 10);
      const year = parseInt(trMatch[3], 10);
      const hour = trMatch[4] ? parseInt(trMatch[4], 10) : 0;
      const minute = trMatch[5] ? parseInt(trMatch[5], 10) : 0;
      const second = trMatch[6] ? parseInt(trMatch[6], 10) : 0;

      // Handle dayFirst option
      if (options?.dayFirst === false && month <= 12 && day <= 12) {
        // swap if user explicitly specified month first (MM.dd.yyyy)
        const tmp = day;
        day = month;
        month = tmp;
      }

      if (month < 1 || month > 12 || day < 1 || day > 31) return null;

      const date = new Date(year, month - 1, day, hour, minute, second);
      return isNaN(date.getTime()) ? null : date;
    }

    // yyyy-MM-dd or yyyy.MM.dd or yyyy/MM/dd
    const isoMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
      const minute = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
      const second = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;

      if (month < 1 || month > 12 || day < 1 || day > 31) return null;

      const date = new Date(year, month - 1, day, hour, minute, second);
      return isNaN(date.getTime()) ? null : date;
    }

    // Fallback standard Date.parse
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  /**
   * Parse numeric / money value.
   * Handles TR formatting '1.234,56' or EN '1,234.56'.
   * Strips currency symbols (₺, TL, $, €, etc.).
   */
  static parseNumber(val: any, options?: NumberParseOptions): number | null {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;

    let str = String(val).trim();
    if (!str) return null;

    // Remove currency symbols & characters: TL, TRY, USD, EUR, $, €, ₺, etc.
    str = str.replace(/[₺$€£¥]/g, '');
    str = str.replace(/\b(tl|try|usd|eur|gbp)\b/gi, '');
    str = str.trim();

    // Determine decimal separator
    let decimalSep = options?.decimalSeparator || 'auto';

    if (decimalSep === 'auto') {
      const hasComma = str.includes(',');
      const hasDot = str.includes('.');

      if (hasComma && hasDot) {
        // Whichever comes last is the decimal separator
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
          decimalSep = ','; // e.g. 1.234,56
        } else {
          decimalSep = '.'; // e.g. 1,234.56
        }
      } else if (hasComma) {
        // e.g. "1234,56" or "1,234"
        // If there are exactly 2 digits after comma or 1-3 digits at the end
        decimalSep = ',';
      } else {
        decimalSep = '.';
      }
    }

    if (decimalSep === ',') {
      // Dots are thousands separators, comma is decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Commas are thousands separators, dot is decimal
      str = str.replace(/,/g, '');
    }

    // Remove any remaining unwanted characters (keep digits, leading minus, and one dot)
    str = str.replace(/[^\d.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Normalize Phone number.
   * For Turkish numbers: normalizes to +905XXXXXXXXX.
   * For other numbers: keeps E.164 if valid.
   */
  static parsePhone(val: any): { phone: string | null; warning?: string } {
    if (val === null || val === undefined || val === '') {
      return { phone: null };
    }

    let str = String(val).trim();
    if (!str) return { phone: null };

    // Remove spaces, dashes, dots, parentheses
    const digitsOnly = str.replace(/\D/g, '');

    // Turkish numbers check
    // 05xx... (11 digits) -> +905xx...
    if (digitsOnly.length === 11 && digitsOnly.startsWith('05')) {
      return { phone: `+90${digitsOnly.slice(1)}` };
    }
    // 5xx... (10 digits starting with 5) -> +905xx...
    if (digitsOnly.length === 10 && digitsOnly.startsWith('5')) {
      return { phone: `+90${digitsOnly}` };
    }
    // 905xx... (12 digits) -> +905xx...
    if (digitsOnly.length === 12 && digitsOnly.startsWith('905')) {
      return { phone: `+${digitsOnly}` };
    }
    // Already has leading +
    if (str.startsWith('+') && digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return { phone: `+${digitsOnly}` };
    }

    // General fallback: return cleaned digits if 10-12 chars, otherwise warning
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return {
        phone: str.startsWith('+') ? `+${digitsOnly}` : digitsOnly,
        warning: `Telefon numarası standart biçimde (+90...) değil: ${val}`,
      };
    }

    return {
      phone: str,
      warning: `Geçersiz telefon numarası: ${val}`,
    };
  }

  /**
   * Parse Boolean values:
   * evet/hayır, true/false, 1/0, var/yok, e/h, yes/no
   */
  static parseBoolean(val: any): boolean | null {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'boolean') return val;

    const s = String(val).trim().toLowerCase();
    if (['true', '1', 'evet', 'e', 'yes', 'y', 'var', 'aktif', 'on'].includes(s)) {
      return true;
    }
    if (['false', '0', 'hayır', 'hayir', 'h', 'no', 'n', 'yok', 'pasif', 'off'].includes(s)) {
      return false;
    }
    return null;
  }

  /**
   * Clean string: trim, strip leading spreadsheet injection quote ('=', '+', '-', '@'), truncate length
   */
  static cleanString(val: any, maxLength?: number): string {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();

    // If string was exported with formula escape quote ('= or '- etc.) strip the leading quote
    if (/^'([=+\-@\t\r].*)/.test(str)) {
      str = str.slice(1);
    }

    if (maxLength && str.length > maxLength) {
      str = str.slice(0, maxLength);
    }
    return str;
  }
}
