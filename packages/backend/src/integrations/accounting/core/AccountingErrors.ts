import { BadRequestException, HttpException, HttpStatus, NotImplementedException } from '@nestjs/common';

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

// --- Agent çatısı hataları (docs/mikro.agent.md §6, K3/K7/K8) ---

/** K3: NOT_SUPPORTED yetenek çağrısı → NotImplementedException, sahte başarı yok. */
export class CapabilityNotSupportedError extends NotImplementedException {
  constructor(provider: string, capability: string) {
    super(`[${provider}] '${capability}' yeteneği desteklenmiyor (NOT_SUPPORTED).`);
    this.name = 'CapabilityNotSupportedError';
  }
}

/** K3/K12: ticari veya sözleşmesel karar olmadan açılamayan yetenek (onaylı mod). */
export class CapabilityContractRequiredError extends HttpException {
  constructor(provider: string, capability: string, reason?: string) {
    super(
      `[${provider}] '${capability}' yeteneği sözleşme/onay gerektirir (CONTRACT_REQUIRED).${reason ? ` ${reason}` : ''}`,
      HttpStatus.CONFLICT,
    );
    this.name = 'CapabilityContractRequiredError';
  }
}

/** Kapanmış döneme yazma connector'a ulaşmadan reddedilir. */
export class ClosedPeriodError extends HttpException {
  constructor(periodNo: string, issuedAt: string) {
    super(
      `Belge tarihi (${issuedAt}) bağlantının dönemiyle (${periodNo}) uyuşmuyor; kapanmış döneme yazılmaz.`,
      HttpStatus.BAD_REQUEST,
    );
    this.name = 'ClosedPeriodError';
  }
}

/** K8: tarihe bağlı kimlik — Agent ile ERP arasında saat farkı varsa iş çalıştırılmaz. */
export class ClockSkewError extends HttpException {
  constructor(skewSec: number, limitSec: number) {
    super(`Saat farkı ${skewSec}s, sınır ${limitSec}s (erp_clock_skew).`, HttpStatus.CONFLICT);
    this.name = 'ClockSkewError';
  }
}

/** K7: manifest dışı queryId, tanımsız/geçersiz parametre veya salt-okunur olmayan SQL. */
export class CatalogQueryRejectedError extends HttpException {
  constructor(message: string) {
    super(`Katalog sorgusu reddedildi: ${message}`, HttpStatus.BAD_REQUEST);
    this.name = 'CatalogQueryRejectedError';
  }
}

/** K7: beklenen kolon yoksa akış durur — boş sonuçla devam etmez. */
export class CatalogSchemaDriftError extends HttpException {
  constructor(queryId: string, missing: string[]) {
    super(
      `'${queryId}' sonucunda beklenen kolon(lar) yok: ${missing.join(', ')} (catalog_schema_drift).`,
      HttpStatus.CONFLICT,
    );
    this.name = 'CatalogSchemaDriftError';
  }
}

/** D6 / K17 (docs/nebim.v3.agent.md §4, §6): zorunlu kayıt parametreleri eksikken yazma işi kuyruğa girmez. */
export class PostingDefaultsMissingError extends HttpException {
  readonly missingFields: string[];
  readonly provider: string;

  constructor(provider: string, missing: string[]) {
    super(
      `[${provider}] Zorunlu kayıt parametreleri eksik: ${missing.join(', ')} (posting_defaults_missing).`,
      HttpStatus.BAD_REQUEST,
    );
    this.name = 'PostingDefaultsMissingError';
    this.provider = provider;
    this.missingFields = missing;
  }
}

/** K14 (docs/nebim.v3.agent.md §5): eşzamanlı oturum tavanı lisans sınırıdır. */
export class SessionLimitReachedError extends HttpException {
  constructor(provider: string, maxSessions: number) {
    super(
      `[${provider}] Eşzamanlı oturum tavanına (${maxSessions}) ulaşıldı (erp_session_limit).`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    this.name = 'SessionLimitReachedError';
  }
}

/**
 * K17: Kayıt parametreleri doğrulanmadan yazma işi kuyruğa girmez.
 */
export function assertPostingDefaults(
  spec: readonly import('./AccountingTypes').PostingFieldSpec[] | undefined,
  values: Record<string, any> | undefined | null,
  jobType: 'INVOICE' | 'RECEIPT' | 'ORDER' | 'STOCK',
  providerId: string,
): void {
  if (!spec || !spec.length) return;
  if (values) {
    const known = new Set(spec.map((s) => s.key));
    for (const k of Object.keys(values)) {
      if (!known.has(k)) {
        throw new BadRequestException(`Tanımsız kayıt parametresi: ${k}`);
      }
    }
  }
  const missing: string[] = [];
  for (const field of spec) {
    if (field.required && field.appliesTo.includes(jobType)) {
      const val = values ? values[field.key] : undefined;
      if (val === undefined || val === null || val === '') {
        missing.push(field.key);
      }
    }
  }
  if (missing.length > 0) {
    throw new PostingDefaultsMissingError(providerId, missing);
  }
}

