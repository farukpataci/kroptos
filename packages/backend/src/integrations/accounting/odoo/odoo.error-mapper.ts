import {
  AccountingAuthError,
  AccountingApiError,
  AccountingRateLimitError,
  IntegrationNotVerifiedError,
} from '../core/AccountingErrors';

/**
 * Odoo Error Mapper (§3.3, §6)
 *
 * Handles both:
 * 1. JSON-2 HTTP status codes (401, 403, 429, 422, 500)
 * 2. Classic RPC HTTP 200 with { error: ... } payload blocks
 */
export class OdooErrorMapper {
  static handleHttpOrRpcError(err: any): never {
    if (
      err instanceof IntegrationNotVerifiedError ||
      err?.name === 'IntegrationNotVerifiedError'
    ) {
      throw err;
    }

    const status = err?.response?.status || err?.status || 500;
    const data = err?.response?.data || err?.data;
    const rawMessage =
      data?.message ||
      data?.data?.message ||
      err?.message ||
      'Odoo entegrasyon çağrısı sırasında bir hata oluştu.';

    // Check rate limit (429 or concurrency lock message)
    if (
      status === 429 ||
      rawMessage.toLowerCase().includes('rate limit') ||
      rawMessage.toLowerCase().includes('too many requests')
    ) {
      throw new AccountingRateLimitError('odoo', 60);
    }

    // Check authentication / access denied
    if (
      status === 401 ||
      status === 403 ||
      rawMessage.toLowerCase().includes('access denied') ||
      rawMessage.toLowerCase().includes('invalid api key') ||
      rawMessage.toLowerCase().includes('authentication failed')
    ) {
      throw new AccountingAuthError(
        'odoo',
        `Odoo kimlik doğrulama veya yetki hatası (${status}): ${rawMessage}. Lütfen API anahtarını kontrol edin.`,
      );
    }

    // Validation / Business logic error (e.g. 422 in JSON-2 or ValidationError in RPC)
    if (
      status === 422 ||
      status === 400 ||
      rawMessage.toLowerCase().includes('validationerror') ||
      rawMessage.toLowerCase().includes('usererror')
    ) {
      throw new AccountingApiError(
        'odoo',
        400,
        `Odoo iş kuralı / doğrulama hatası: ${rawMessage}`,
        data,
      );
    }

    throw new AccountingApiError(
      'odoo',
      status >= 400 && status < 600 ? status : 500,
      `Odoo API hatası (${status}): ${rawMessage}`,
      data,
    );
  }
}
