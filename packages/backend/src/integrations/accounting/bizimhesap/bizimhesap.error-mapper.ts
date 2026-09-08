/**
 * BizimHesap Error Mapper
 * Source: https://apidocs.bizimhesap.com (2026-09)
 */

import {
  AccountingApiError,
  AccountingAuthError,
  AccountingNetworkError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';
import { BizimhesapApiResponse } from './bizimhesap.types';

export class BizimhesapErrorMapper {
  /**
   * Checks BizimHesap API response body.
   * In BizimHesap, errors can return with HTTP 200 containing a non-empty `error` string.
   */
  static checkApiResponse(response: BizimhesapApiResponse): void {
    if (!response) {
      throw new AccountingApiError('BIZIMHESAP', 500, 'BizimHesap boş yanıt döndü');
    }

    // 1. Error field is populated -> definite error
    if (response.error && response.error.trim().length > 0) {
      throw new AccountingApiError(
        'BIZIMHESAP',
        200,
        response.error.trim(),
        response,
      );
    }

    // 2. Both error and guid are empty -> corrupted / incomplete response (§7)
    if (!response.guid || response.guid.trim().length === 0) {
      throw new AccountingApiError(
        'BIZIMHESAP',
        200,
        'Bozuk BizimHesap API cevabı: error ve guid alanları boş.',
        response,
      );
    }
  }

  static handleHttpError(error: any): never {
    const status = error.response?.status;
    const data = error.response?.data as BizimhesapApiResponse | undefined;
    const message =
      data?.error ||
      error.message ||
      'Bilinmeyen BizimHesap hatası';

    if (status === 401 || status === 403) {
      throw new AccountingAuthError('BIZIMHESAP', `Kimlik doğrulama başarısız: ${message}`);
    }

    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'];
      throw new AccountingRateLimitError(
        'BIZIMHESAP',
        retryAfter ? parseInt(retryAfter, 10) : undefined,
      );
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || !error.response) {
      throw new AccountingNetworkError('BIZIMHESAP', `Ağ bağlantı hatası: ${error.message}`);
    }

    throw new AccountingApiError('BIZIMHESAP', status || 500, message, data);
  }
}
