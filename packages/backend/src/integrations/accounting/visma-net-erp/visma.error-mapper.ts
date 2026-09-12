import {
  AccountingApiError,
  AccountingAuthError,
  AccountingRateLimitExceededError,
} from '../core/AccountingErrors';

export class VismaErrorMapper {
  /**
   * Mask sensitive tokens and secrets from error messages and URLs (§9.2 #20)
   */
  static maskSensitive(input: string): string {
    if (!input) return input;
    return input
      .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]')
      .replace(/(access_token["']?\s*[:=]\s*["']?)[^"',&\s]+/gi, '$1[REDACTED]')
      .replace(/(refresh_token["']?\s*[:=]\s*["']?)[^"',&\s]+/gi, '$1[REDACTED]')
      .replace(/(client_secret["']?\s*[:=]\s*["']?)[^"',&\s]+/gi, '$1[REDACTED]')
      .replace(/(clientSecret["']?\s*[:=]\s*["']?)[^"',&\s]+/gi, '$1[REDACTED]');
  }

  /**
   * Map HTTP error or API exception to KroptOS standard accounting errors.
   */
  static mapHttpError(status: number, statusText: string, bodyText: string, headers?: Record<string, string | undefined>): Error {
    const cleanBody = this.maskSensitive(bodyText || statusText);

    if (status === 401) {
      return new AccountingAuthError(
        'VISMA-NET-ERP',
        `Kimlik doğrulama hatası (401): ${cleanBody}`,
      );
    }

    if (status === 429) {
      let retryAfterSeconds = 60;
      if (headers) {
        const retryHeader = headers['retry-after'] || headers['Retry-After'];
        if (retryHeader) {
          const seconds = parseInt(retryHeader, 10);
          if (Number.isFinite(seconds) && seconds > 0) {
            retryAfterSeconds = seconds;
          }
        }
      }
      return new AccountingRateLimitExceededError(
        'VISMA-NET-ERP',
        retryAfterSeconds,
      );
    }

    return new AccountingApiError(
      'VISMA-NET-ERP',
      status,
      cleanBody,
      bodyText,
    );
  }
}
