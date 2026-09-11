import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitExceededError,
} from '../core/AccountingErrors';
import { FortnoxErrorResponse } from './fortnox.types';

export class FortnoxErrorMapper {
  /**
   * Mask secrets in error message or payload (§14)
   */
  static maskSensitive(input: string): string {
    if (!input) return input;
    return input
      .replace(/(Bearer\s+)[A-Za-z0-9-_.]+/gi, '$1***')
      .replace(/(client_secret=)[^\s&]+/gi, '$1***')
      .replace(/(clientSecret["']?\s*[:=]\s*["'])[^"']+(["']?)/gi, '$1***$2')
      .replace(/(code=)[^\s&]+/gi, '$1***')
      .replace(/(refresh_token=)[^\s&]+/gi, '$1***')
      .replace(/(access_token=)[^\s&]+/gi, '$1***')
      .replace(/(state=)[^\s&]+/gi, '$1***');
  }

  /**
   * Map Fortnox HTTP status and response body to KroptOS domain error.
   */
  static mapError(
    status: number,
    data?: FortnoxErrorResponse | any,
    retryAfterSeconds?: number,
  ): Error {
    const errorInfo = data?.ErrorInformation;
    const rawMessage =
      errorInfo?.message ||
      data?.error_description ||
      data?.message ||
      data?.error ||
      `Fortnox isteği başarısız oldu (HTTP ${status})`;

    const maskedMessage = FortnoxErrorMapper.maskSensitive(rawMessage);

    if (status === 401) {
      return new AccountingAuthError(
        'fortnox',
        `Fortnox kimlik doğrulama hatası: ${maskedMessage}`,
      );
    }

    if (status === 429) {
      return new AccountingRateLimitExceededError(
        'fortnox',
        retryAfterSeconds ?? 5,
      );
    }

    return new AccountingApiError(
      'fortnox',
      status,
      maskedMessage,
      data,
    );
  }
}
