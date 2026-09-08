import {
  AccountingApiError,
  AccountingAuthError,
  AccountingNetworkError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';
import { KolaybiApiResponse } from './kolaybi.types';

export class KolaybiErrorMapper {
  static handleHttpError(error: any): never {
    const status = error.response?.status;
    const data = error.response?.data as KolaybiApiResponse | undefined;
    const message =
      data?.message ||
      data?.error ||
      (data?.errors ? Object.values(data.errors).flat().join(', ') : null) ||
      error.message ||
      'Bilinmeyen KolayBi hatası';

    if (status === 401 || status === 403) {
      throw new AccountingAuthError('KOLAYBI', `Kimlik doğrulama başarısız: ${message}`);
    }

    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'];
      throw new AccountingRateLimitError(
        'KOLAYBI',
        retryAfter ? parseInt(retryAfter, 10) : undefined,
      );
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || !error.response) {
      throw new AccountingNetworkError('KOLAYBI', `Ağ bağlantı hatası: ${error.message}`);
    }

    throw new AccountingApiError('KOLAYBI', status || 500, message, data);
  }

  static checkApiResponse(response: KolaybiApiResponse): void {
    if (response && response.success === false) {
      const message =
        response.message ||
        response.error ||
        (response.errors ? Object.values(response.errors).flat().join(', ') : null) ||
        'KolayBi işlemi başarısız sonuçlandı';
      throw new AccountingApiError('KOLAYBI', 200, message, response);
    }
  }
}
