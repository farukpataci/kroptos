import { HttpException, HttpStatus } from '@nestjs/common';

export class IntegrationNotVerifiedError extends HttpException {
  constructor(provider: string, environment: string) {
    super(
      `Integration with '${provider}' in '${environment}' environment is not verified. Real network requests are prohibited until credentials and endpoints are verified. Current readiness: MOCK_READY.`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    this.name = 'IntegrationNotVerifiedError';
  }
}

export class AccountingIdempotencyError extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT);
    this.name = 'AccountingIdempotencyError';
  }
}

export class AccountingAmountMismatchError extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
    this.name = 'AccountingAmountMismatchError';
  }
}

export class AccountingRateLimitExceededError extends HttpException {
  constructor(provider: string, retryAfterSeconds?: number) {
    super(
      `Rate limit exceeded for provider '${provider}'.${retryAfterSeconds ? ` Retry after ${retryAfterSeconds}s.` : ''}`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.name = 'AccountingRateLimitExceededError';
  }
}

export class AccountingApiError extends HttpException {
  public readonly provider: string;
  public readonly statusCode: number;
  public readonly rawResponse?: any;

  constructor(provider: string, statusCode: number, message: string, rawResponse?: any) {
    super(
      `[${provider}] API error (${statusCode}): ${message}`,
      statusCode >= 400 && statusCode < 600 ? statusCode : HttpStatus.INTERNAL_SERVER_ERROR,
    );
    this.name = 'AccountingApiError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.rawResponse = rawResponse;
  }
}

export class AccountingAuthError extends HttpException {
  constructor(provider: string, message: string) {
    super(`[${provider}] Authentication error: ${message}`, HttpStatus.UNAUTHORIZED);
    this.name = 'AccountingAuthError';
  }
}

export class AccountingNetworkError extends HttpException {
  constructor(provider: string, message: string) {
    super(`[${provider}] Network error: ${message}`, HttpStatus.GATEWAY_TIMEOUT);
    this.name = 'AccountingNetworkError';
  }
}

export { AccountingRateLimitExceededError as AccountingRateLimitError };
