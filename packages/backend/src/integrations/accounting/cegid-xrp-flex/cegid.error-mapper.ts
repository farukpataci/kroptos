import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';

export class CegidErrorMapper {
  /**
   * Hata mesajlarındaki token ve gizli anahtarları maskeler (§5, §9 #12).
   */
  static maskSensitive(input: string): string {
    if (!input) return input;
    return input
      .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]')
      .replace(/(access_token["']?\s*[:=]\s*["']?)[^"',&\s]+/gi, '$1[REDACTED]')
      .replace(/(refresh_token["']?\s*[:=]\s*["']?)[^"',&\s]+/gi, '$1[REDACTED]')
      .replace(/(client_secret["']?\s*[:=]\s*["']?)[^"',&\s]+/gi, '$1[REDACTED]')
      .replace(/(password["']?\s*[:=]\s*["']?)[^"',&\s]+/gi, '$1[REDACTED]');
  }

  /**
   * HTTP durum kodunu ve hata gövdesini standart KroptOS hatasına eşler.
   */
  static mapHttpError(
    status: number,
    statusText: string,
    bodyText: string,
    headers?: Record<string, string | undefined>,
  ): Error {
    const cleanBody = this.maskSensitive(bodyText || statusText);

    if (status === 401 || status === 403) {
      return new AccountingAuthError(
        'CEGID-XRP-FLEX',
        `Kimlik doğrulama veya yetki hatası (${status}): ${cleanBody}`,
      );
    }

    if (status === 429) {
      let retryAfter = 60;
      if (headers) {
        const headerVal = headers['retry-after'] || headers['Retry-After'];
        if (headerVal) {
          const parsed = parseInt(headerVal, 10);
          if (Number.isFinite(parsed) && parsed > 0) {
            retryAfter = parsed;
          }
        }
      }
      return new AccountingRateLimitError('CEGID-XRP-FLEX', retryAfter);
    }

    return new AccountingApiError(
      'CEGID-XRP-FLEX',
      status,
      cleanBody,
      bodyText,
    );
  }
}
