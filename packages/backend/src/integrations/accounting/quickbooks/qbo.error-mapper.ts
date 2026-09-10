import {
  AccountingAuthError,
  AccountingApiError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';
import { QBOErrorResponse } from './qbo.types';

export class QBOErrorMapper {
  static handleHttpError(err: any): never {
    const status = err?.response?.status || err?.status;
    const data: QBOErrorResponse = err?.response?.data || err?.data;

    // Check QBO Fault payload
    if (data?.Fault?.Error && Array.isArray(data.Fault.Error) && data.Fault.Error.length > 0) {
      const firstError = data.Fault.Error[0];
      const code = firstError.code;
      const message = firstError.Message || 'QuickBooks API hatası';
      const detail = firstError.Detail ? ` (${firstError.Detail})` : '';

      if (code === '5010') {
        const error = new AccountingApiError('quickbooks', 409, `Stale Object Error [5010]: ${message}${detail}`, data);
        (error as any).code = '5010';
        throw error;
      }

      if (code === '3200' || status === 401) {
        throw new AccountingAuthError('quickbooks', `REAUTHORIZATION_REQUIRED: [${code}] ${message}${detail}`);
      }

      if (status === 429) {
        throw new AccountingRateLimitError('quickbooks', 60);
      }

      if (status === 400 || data.Fault.type === 'ValidationFault') {
        throw new AccountingApiError('quickbooks', 400, `İş kuralı hatası [${code}]: ${message}${detail}`, data);
      }

      throw new AccountingApiError('quickbooks', status || 500, `QBO Hatası [${code}]: ${message}${detail}`, data);
    }

    if (status === 429) {
      throw new AccountingRateLimitError('quickbooks', 60);
    }

    if (status === 401 || status === 403) {
      throw new AccountingAuthError('quickbooks', 'QuickBooks Online yetkilendirme hatası (401/403). Oturumu tazeleyin.');
    }

    throw new AccountingApiError(
      'quickbooks',
      status || 500,
      err?.message || 'QuickBooks Online API çağrısı sırasında bilinmeyen bir hata oluştu.',
    );
  }
}
