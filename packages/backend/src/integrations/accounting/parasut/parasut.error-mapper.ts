import { AccountingApiError } from '../core/AccountingErrors';

export class ParasutErrorMapper {
  static normalize(error: any): Error {
    if (error?.status || error?.statusCode) {
      const code = error.status || error.statusCode;
      const message =
        error.response?.data?.errors?.[0]?.detail ||
        error.response?.data?.error_description ||
        error.message ||
        'Bilinmeyen Paraşüt API hatası';
      return new AccountingApiError('PARASUT', code, message, error.response?.data);
    }
    return error;
  }
}
