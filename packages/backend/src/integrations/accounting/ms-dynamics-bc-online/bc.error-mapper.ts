import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitExceededError,
} from '../core/AccountingErrors';
import { BusinessCentralOData } from './bc.odata';

export class BusinessCentralPreconditionFailedError extends AccountingApiError {
  constructor(message: string, rawResponse?: any) {
    super('MS_DYNAMICS_BC_ONLINE', 412, message, rawResponse);
    this.name = 'BusinessCentralPreconditionFailedError';
  }
}

export class BusinessCentralErrorMapper {
  /**
   * Maps HTTP response and raw body from Business Central or Entra ID to appropriate domain exception.
   */
  static mapHttpError(
    statusCode: number,
    rawBody: any,
    headers?: Record<string, string | string[] | undefined>,
  ): Error {
    const odataErr = BusinessCentralOData.parseODataError(rawBody);
    const rawMsg = odataErr.message || `HTTP ${statusCode}`;

    // Clean any potential tokens or secrets from message
    const sanitizedMsg = this.sanitizeMessage(rawMsg);

    switch (statusCode) {
      case 401:
        // §3.2: 401 is an Entra ID token/credential issue
        return new AccountingAuthError(
          'MS_DYNAMICS_BC_ONLINE',
          `Entra ID kimlik doğrulama hatası (401): İstemci kimliği (Client ID) veya parolası (Secret) geçersiz. ${sanitizedMsg}`,
        );

      case 403:
        // §3.2: 403 means Entra ID succeeded, but BC Permission Sets are missing
        return new AccountingApiError(
          'MS_DYNAMICS_BC_ONLINE',
          403,
          `Business Central yetki hatası (403): Entra kimlik doğrulaması başarılı ancak Business Central içinde uygulamaya gerekli izin kümesi (ör. D365 BASIC, D365 SALES DOC, EDIT) atanmamış veya 'Grant Consent' verilmemiş. ${sanitizedMsg}`,
          rawBody,
        );

      case 412:
        // §4.8: 412 Precondition Failed (ETag/If-Match mismatch) - non-retryable
        return new BusinessCentralPreconditionFailedError(
          `Kayıt Business Central üzerinde başka bir kullanıcı veya işlem tarafından değiştirildi (ETag uyuşmazlığı, 412). ${sanitizedMsg}`,
          rawBody,
        );

      case 429: {
        // §3.5: Throttling / Rate limit
        let retryAfterSec = 5;
        if (headers) {
          const retryHeader = headers['retry-after'] || headers['Retry-After'];
          if (typeof retryHeader === 'string') {
            const parsed = parseInt(retryHeader, 10);
            if (!isNaN(parsed) && parsed > 0) {
              retryAfterSec = parsed;
            }
          }
        }
        return new AccountingRateLimitExceededError('MS_DYNAMICS_BC_ONLINE', retryAfterSec);
      }

      default:
        return new AccountingApiError(
          'MS_DYNAMICS_BC_ONLINE',
          statusCode,
          sanitizedMsg,
          rawBody,
        );
    }
  }

  /**
   * Mask secrets/tokens in error messages.
   */
  static sanitizeMessage(msg: string): string {
    return msg
      .replace(/client_secret=[^\s&]+/gi, 'client_secret=***')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***');
  }
}
