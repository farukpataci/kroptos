import {
  AccountingApiError,
  AccountingAuthError,
  AccountingNetworkError,
  AccountingRateLimitExceededError,
} from '../core/AccountingErrors';

export interface ParsedSageError {
  statusCode: number;
  message: string;
  dataCode?: string;
  retryAfterSeconds?: number;
  isTransient: boolean;
}

export class SageErrorMapper {
  static parseResponse(status: number, body: any, headers?: Headers): ParsedSageError {
    let message = `Sage API hatası (${status})`;
    let dataCode: string | undefined;

    if (body) {
      if (typeof body === 'string') {
        message = body;
      } else if (body.$dataCode) {
        dataCode = body.$dataCode;
        message = body.$message || body.$dataCode;
      } else if (Array.isArray(body.$errors) && body.$errors.length > 0) {
        message = body.$errors.map((e: any) => e.$message || e.message || JSON.stringify(e)).join('; ');
      } else if (body.error_description) {
        message = body.error_description;
      } else if (body.error) {
        message = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
      } else if (body.message) {
        message = body.message;
      }
    }

    let retryAfterSeconds: number | undefined;
    if (headers) {
      const retryHeader = headers.get('retry-after');
      if (retryHeader) {
        const parsed = parseInt(retryHeader, 10);
        if (!isNaN(parsed) && parsed > 0) {
          retryAfterSeconds = parsed;
        }
      }
    }

    // 429 or RateLimitExceeded
    if (status === 429 || dataCode === 'RateLimitExceeded') {
      return {
        statusCode: 429,
        message,
        dataCode: dataCode || 'RateLimitExceeded',
        retryAfterSeconds: retryAfterSeconds || 60,
        isTransient: true,
      };
    }

    // Auth errors
    if (status === 401 || status === 403) {
      return {
        statusCode: status,
        message,
        dataCode,
        isTransient: false,
      };
    }

    // 5xx Transient
    const isTransient = status >= 500 && status <= 599;

    return {
      statusCode: status,
      message,
      dataCode,
      retryAfterSeconds,
      isTransient,
    };
  }

  static toDomainError(parsed: ParsedSageError, rawResponse?: any): Error {
    if (parsed.statusCode === 429 || parsed.dataCode === 'RateLimitExceeded') {
      return new AccountingRateLimitExceededError('sage-accounting', parsed.retryAfterSeconds);
    }

    if (parsed.statusCode === 401 || parsed.statusCode === 403) {
      return new AccountingAuthError('sage-accounting', parsed.message);
    }

    if (parsed.isTransient) {
      return new AccountingNetworkError('sage-accounting', parsed.message);
    }

    return new AccountingApiError('sage-accounting', parsed.statusCode, parsed.message, rawResponse);
  }
}
