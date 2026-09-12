import { HttpException } from '@nestjs/common';
import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';

export class ExactErrorMapper {
  static map(
    status: number,
    errorBody?: any,
    headers?: Record<string, any>,
  ): HttpException {
    let rawMsg = 'Bilinmeyen Exact Online API hatası';
    if (typeof errorBody === 'string') {
      rawMsg = errorBody;
    } else if (errorBody?.error?.message?.value) {
      rawMsg = errorBody.error.message.value;
    } else if (errorBody?.error_description) {
      rawMsg = errorBody.error_description;
    } else if (errorBody?.message) {
      rawMsg = errorBody.message;
    }

    // Hassas token ve parolaları maskele
    rawMsg = rawMsg
      .replace(/client_secret=[^&]+/gi, 'client_secret=***')
      .replace(/access_token=[^&]+/gi, 'access_token=***')
      .replace(/refresh_token=[^&]+/gi, 'refresh_token=***');

    switch (status) {
      case 401:
        return new AccountingAuthError(
          'EXACT-ONLINE',
          `Kimlik doğrulama başarısız (HTTP 401). Access token geçersiz veya süresi dolmuş olabilir. ${rawMsg}`,
        );

      case 429: {
        let retryAfterSeconds: number | undefined;

        // 1. Retry-After başlığı (varsa saniye cinsinden)
        const retryHeader = headers?.['retry-after'] || headers?.['Retry-After'];
        if (retryHeader) {
          const parsed = parseInt(String(retryHeader), 10);
          if (!isNaN(parsed) && parsed > 0) {
            retryAfterSeconds = parsed;
          }
        }

        // 2. X-RateLimit-Reset başlığı (UTC epoch MİLİSANİYE - §5.1)
        if (!retryAfterSeconds) {
          const resetHeader =
            headers?.['x-ratelimit-reset'] || headers?.['X-RateLimit-Reset'];
          if (resetHeader) {
            const resetMs = parseInt(String(resetHeader), 10);
            if (!isNaN(resetMs) && resetMs > Date.now()) {
              retryAfterSeconds = Math.ceil((resetMs - Date.now()) / 1000);
            }
          }
        }

        return new AccountingRateLimitError('EXACT-ONLINE', retryAfterSeconds);
      }

      default:
        return new AccountingApiError('EXACT-ONLINE', status, rawMsg, errorBody);
    }
  }
}
