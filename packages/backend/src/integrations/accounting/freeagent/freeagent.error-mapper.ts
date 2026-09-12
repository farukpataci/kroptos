import { HttpException } from '@nestjs/common';
import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';

export interface FreeAgentApiErrorBody {
  errors?: {
    error?: string[];
    [key: string]: any;
  };
  error?: string;
  message?: string;
}

export class FreeAgentErrorMapper {
  /**
   * §5.6 & §2.1 Maps FreeAgent API errors to standardized KroptOS accounting errors.
   * Extracts Retry-After on 429 and masks sensitive data.
   */
  static map(
    status: number,
    errorBody?: FreeAgentApiErrorBody | any,
    retryAfterHeader?: string | number | null,
  ): HttpException {
    let rawMsg = 'FreeAgent API Hatası';

    if (errorBody) {
      if (typeof errorBody === 'string') {
        rawMsg = errorBody;
      } else if (errorBody.errors) {
        if (Array.isArray(errorBody.errors.error)) {
          rawMsg = errorBody.errors.error.join(', ');
        } else if (typeof errorBody.errors === 'object') {
          rawMsg = JSON.stringify(errorBody.errors);
        }
      } else if (errorBody.error) {
        rawMsg = String(errorBody.error);
      } else if (errorBody.message) {
        rawMsg = String(errorBody.message);
      }
    }

    switch (status) {
      case 401:
        return new AccountingAuthError(
          'freeagent',
          `Kimlik doğrulama başarısız (HTTP 401). Access token geçersiz veya yetkilendirme süresi dolmuş olabilir. ${rawMsg}`,
        );

      case 429: {
        // §5.6 429'da Retry-After'a uy
        let retryAfterSeconds: number | undefined;
        if (retryAfterHeader !== undefined && retryAfterHeader !== null) {
          const seconds = parseInt(String(retryAfterHeader), 10);
          if (!isNaN(seconds) && seconds > 0) {
            retryAfterSeconds = seconds;
          }
        }
        return new AccountingRateLimitError('freeagent', retryAfterSeconds);
      }

      default:
        return new AccountingApiError('freeagent', status, rawMsg, errorBody);
    }
  }
}
