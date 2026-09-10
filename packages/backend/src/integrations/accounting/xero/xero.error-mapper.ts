import {
  AccountingApiError,
  AccountingAuthError,
  AccountingNetworkError,
  AccountingRateLimitExceededError,
} from '../core/AccountingErrors';
import { XeroRateLimitInfo } from './xero.types';

export interface ParsedXeroError {
  statusCode: number;
  message: string;
  errorNumber?: number;
  type?: string;
  validationErrors: string[];
  rateLimitInfo?: XeroRateLimitInfo;
  isTransient: boolean;
}

export class XeroErrorMapper {
  static parseResponse(status: number, body: any, headers?: Headers): ParsedXeroError {
    let message = `Xero API hatası (${status})`;
    let errorNumber: number | undefined;
    let type: string | undefined;
    const validationErrors: string[] = [];

    if (body) {
      if (typeof body === 'string') {
        message = body;
      } else {
        if (body.ErrorNumber) errorNumber = body.ErrorNumber;
        if (body.Type) type = body.Type;
        if (body.Message) message = body.Message;

        // Top-level ValidationErrors
        if (Array.isArray(body.ValidationErrors)) {
          for (const ve of body.ValidationErrors) {
            if (ve.Message) validationErrors.push(ve.Message);
          }
        }

        // Element-level ValidationErrors (Xero batch / elements array)
        if (Array.isArray(body.Elements)) {
          for (const el of body.Elements) {
            if (Array.isArray(el.ValidationErrors)) {
              for (const ve of el.ValidationErrors) {
                if (ve.Message && !validationErrors.includes(ve.Message)) {
                  validationErrors.push(ve.Message);
                }
              }
            }
          }
        }

        if (validationErrors.length > 0) {
          message = `${message}: ${validationErrors.join('; ')}`;
        }
      }
    }

    const rateLimitInfo: XeroRateLimitInfo = {};
    if (headers) {
      const retryHeader = headers.get('retry-after');
      if (retryHeader) {
        const parsed = parseInt(retryHeader, 10);
        if (!isNaN(parsed) && parsed > 0) {
          rateLimitInfo.retryAfterSeconds = parsed;
        }
      }
      const minLimit = headers.get('x-minlimit-remaining');
      if (minLimit) rateLimitInfo.minuteRemaining = parseInt(minLimit, 10);

      const dayLimit = headers.get('x-daylimit-remaining');
      if (dayLimit) rateLimitInfo.dayRemaining = parseInt(dayLimit, 10);

      const appMinLimit = headers.get('x-appminlimit-remaining');
      if (appMinLimit) rateLimitInfo.appMinuteRemaining = parseInt(appMinLimit, 10);
    }

    const is429 = status === 429;
    const isAuth = status === 401 || status === 403;
    const isTransient = is429 || (status >= 500 && status <= 599);

    return {
      statusCode: status,
      message,
      errorNumber,
      type,
      validationErrors,
      rateLimitInfo,
      isTransient,
    };
  }

  /**
   * Checks if a response with status 200/201 contains inline Xero validation errors
   */
  static hasInlineError(body: any): boolean {
    if (!body || typeof body !== 'object') return false;
    if (body.Status === 'ERROR') return true;
    if (Array.isArray(body.Elements)) {
      return body.Elements.some(
        (el: any) =>
          el.Status === 'ERROR' ||
          (Array.isArray(el.ValidationErrors) && el.ValidationErrors.length > 0),
      );
    }
    return false;
  }

  static toDomainError(parsed: ParsedXeroError, rawResponse?: any): Error {
    if (parsed.statusCode === 429) {
      return new AccountingRateLimitExceededError('XERO', parsed.rateLimitInfo?.retryAfterSeconds || 60);
    }

    if (parsed.statusCode === 401 || parsed.statusCode === 403) {
      return new AccountingAuthError('XERO', parsed.message);
    }

    if (parsed.isTransient) {
      return new AccountingNetworkError('XERO', parsed.message);
    }

    return new AccountingApiError('XERO', parsed.statusCode, parsed.message, rawResponse);
  }
}
