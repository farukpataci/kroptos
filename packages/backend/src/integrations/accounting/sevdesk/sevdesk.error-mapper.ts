import { HttpException } from '@nestjs/common';
import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';

export interface SevdeskApiErrorResponse {
  error?: {
    message?: string;
    code?: number | string;
    data?: any;
  };
}

export class SevdeskErrorMapper {
  static map(status: number, errorBody?: SevdeskApiErrorResponse | any): HttpException {
    const rawMsg =
      errorBody?.error?.message ||
      errorBody?.message ||
      (typeof errorBody === 'string' ? errorBody : 'sevDesk API Hatası');

    switch (status) {
      case 401:
        return new AccountingAuthError(
          'sevdesk',
          `API token geçersiz veya yetkisiz (HTTP 401). Token sahibi kullanıcı silinmiş veya yetkisi kaldırılmış olabilir. ${rawMsg}`,
        );
      case 429:
        return new AccountingRateLimitError('sevdesk');
      default:
        return new AccountingApiError('sevdesk', status, rawMsg, errorBody);
    }
  }
}
