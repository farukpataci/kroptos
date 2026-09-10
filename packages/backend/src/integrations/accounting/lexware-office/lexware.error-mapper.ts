import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';
import { LexwareErrorResponse } from './lexware.types';

/**
 * Specialized validation error for Lexware Office HTTP 406 (§3.6, §5.3)
 * Indicates a permanent business rule or schema validation failure.
 * Must NOT be retried.
 */
export class LexwareValidationError extends AccountingApiError {
  public readonly i18nKey?: string;
  public readonly isRetryable = false;

  constructor(message: string, i18nKey?: string, rawResponse?: any) {
    super('lexware-office', 406, message, rawResponse);
    this.name = 'LexwareValidationError';
    this.i18nKey = i18nKey;
  }
}

/**
 * Sürüm çakışması hatası (HTTP 409) (§3.4, §5.8)
 */
export class LexwareVersionConflictError extends AccountingApiError {
  public readonly isRetryable = true; // Handled strictly once by version-lock

  constructor(message: string, rawResponse?: any) {
    super('lexware-office', 409, message, rawResponse);
    this.name = 'LexwareVersionConflictError';
  }
}

export class LexwareErrorMapper {
  private static readonly KNOWN_I18N_KEYS: Record<string, string> = {
    'invalid_property': 'Geçersiz özellik veya alan değeri',
    'missing_property': 'Zorunlu alan eksik',
    'duplicate_identifier': 'Tekrarlayan kimlik veya referans',
    'voucher_closed': 'Kesinleşmiş belge değiştirilemez',
    'invalid_date_format': 'Tarih biçimi geçersiz',
    'invalid_tax_conditions': 'Vergi koşulları geçersiz',
    'tax_amount_mismatch': 'Vergi ve toplam tutar uyuşmuyor',
    'unknown_article': 'Tanımlanamayan makale veya ürün',
    'unknown_contact': 'Tanımlanamayan müşteri veya cari',
    'contact_address_required': 'Müşteri fatura adresi zorunlu',
  };

  /**
   * Maps Lexware error response to standardized KroptOS errors (§5.3).
   * HTTP 406 is strictly classified as LexwareValidationError based on i18nKey,
   * NOT human text.
   */
  static mapError(status: number, data?: LexwareErrorResponse | any): Error {
    const i18nKey = data?.i18nKey;
    const traceId = data?.traceId;
    const rawMessage = data?.message || data?.error || 'Lexware Office isteği başarısız oldu';

    if (status === 406) {
      const translation = i18nKey ? this.KNOWN_I18N_KEYS[i18nKey] : undefined;
      const description = translation
        ? `${translation} (i18nKey: ${i18nKey})`
        : `Doğrulama hatası (i18nKey: ${i18nKey || 'unknown'}) - ${rawMessage}`;

      const fullMessage = traceId ? `${description} [TraceId: ${traceId}]` : description;
      return new LexwareValidationError(fullMessage, i18nKey, data);
    }

    if (status === 409) {
      const msg = `Sürüm çakışması (HTTP 409): Belge başka bir işlem tarafından güncellenmiş.${traceId ? ` [TraceId: ${traceId}]` : ''}`;
      return new LexwareVersionConflictError(msg, data);
    }

    if (status === 429) {
      return new AccountingRateLimitError('lexware-office');
    }

    if (status === 401 || status === 403) {
      return new AccountingAuthError('lexware-office', `API anahtarı geçersiz veya yetkisiz: ${rawMessage}`);
    }

    if (status === 404) {
      return new AccountingApiError('lexware-office', 404, `Kaynak bulunamadı: ${rawMessage}`, data);
    }

    return new AccountingApiError('lexware-office', status, rawMessage, data);
  }
}
