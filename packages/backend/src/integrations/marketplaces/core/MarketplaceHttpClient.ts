import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

/**
 * Why the transport failed. `http` means the marketplace answered and
 * `upstreamStatus` is set; every other value means nothing was answered, and the
 * distinction decides whether a retry can possibly help.
 */
export type TransportFailure =
  | 'http'
  | 'protocol' // malformed HTTP response (HPE_*), not repairable by retrying
  | 'tls'
  | 'dns'
  | 'url'
  | 'reset' // ECONNRESET / EPIPE / ETIMEDOUT / socket hang up
  | 'timeout' // our own AbortController fired
  | 'unknown';

/**
 * Carries the upstream response through to the caller. Connectors need to tell
 * "your API key is wrong" (401) apart from "you are going too fast" (429) and
 * "the marketplace is down" (5xx); a single BAD_GATEWAY collapses all three
 * into one unusable message.
 */
export class MarketplaceHttpError extends HttpException {
  constructor(
    message: string,
    status: HttpStatus,
    readonly upstreamStatus?: number,
    readonly upstreamBody?: string,
    readonly failureKind: TransportFailure = 'http',
  ) {
    super(message, status);
  }
}

/**
 * Classifies a transport failure. undici reports almost everything as
 * "fetch failed" and hides the real reason in `cause`, so both the code and the
 * message are inspected. Anything unrecognised is treated as fatal: retrying a
 * failure we cannot name is how a wrong request became three wrong requests.
 */
export function classifyTransportFailure(error: any): TransportFailure {
  if (error?.name === 'AbortError') return 'timeout';

  const code = String(error?.cause?.code ?? error?.code ?? '');
  const message = `${error?.message ?? ''} ${error?.cause?.message ?? ''}`;

  if (code.startsWith('HPE_') || /does not match the HTTP\/1\.1 protocol/i.test(message)) {
    return 'protocol';
  }
  if (code === 'ERR_INVALID_URL' || error instanceof TypeError && /Invalid URL/i.test(message)) {
    return 'url';
  }
  if (
    code.startsWith('ERR_TLS') ||
    code.startsWith('CERT_') ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    /certificate|SSL routines/i.test(message)
  ) {
    return 'tls';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns';
  if (
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ETIMEDOUT' ||
    /socket hang up/i.test(message)
  ) {
    return 'reset';
  }

  return 'unknown';
}

const RETRY_SAFE_METHODS = new Set(['GET', 'HEAD']);

/**
 * Whether a second attempt can help *and* is safe to make.
 *
 * A blanket "no status means no retry" throws away the one case where a retry
 * genuinely fixes things (a reset socket on a read), and a blanket "retry
 * everything" replays writes the marketplace may already have accepted. So the
 * decision is per failure class, and any non-idempotent method has to carry an
 * idempotency key to be replayed at all.
 */
export function isRetryable(
  failure: TransportFailure,
  upstreamStatus: number | undefined,
  method: string,
  hasIdempotencyKey: boolean,
): boolean {
  const safeMethod = RETRY_SAFE_METHODS.has(method) || hasIdempotencyKey;
  if (!safeMethod) return false;

  switch (failure) {
    case 'http':
      // 4xx is the caller's fault and fails identically on a retry.
      return upstreamStatus === 429 || (upstreamStatus !== undefined && upstreamStatus >= 500);
    case 'reset':
      return true;
    case 'timeout':
      // A HEAD carries no body to re-read, but a timed-out write is exactly the
      // case where the marketplace may have applied it, so only reads repeat.
      return method === 'GET' || hasIdempotencyKey;
    case 'protocol':
    case 'tls':
    case 'dns':
    case 'url':
    case 'unknown':
      return false;
  }
}

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Trims a body for a seller-facing message without dumping a whole HTML page. */
function summariseBody(body: string): string {
  return body.trim().replace(/\s+/g, ' ').slice(0, 200);
}

@Injectable()
export class MarketplaceHttpClient {
  /**
   * Per attempt, not per call. Deliberately below `budgetMs` so a timed-out GET
   * still has room for its one retry inside the total budget.
   */
  private readonly defaultTimeoutMs = intFromEnv('MARKETPLACE_HTTP_TIMEOUT_MS', 5000);
  /** Hard ceiling on one `request()` call, retries and backoff included. */
  private readonly defaultBudgetMs = intFromEnv('MARKETPLACE_HTTP_BUDGET_MS', 8000);
  /** Total attempts, not extra ones: 2 means one original and one retry. */
  private readonly defaultAttempts = intFromEnv('MARKETPLACE_HTTP_RETRIES', 2);

  async request<T>(
    url: string,
    options: RequestInit & {
      timeout?: number;
      /** Total attempts including the first. */
      retries?: number;
      /** Total wall-clock budget for the whole call. */
      budgetMs?: number;
      /** Marks a non-idempotent method as safe to replay. */
      idempotencyKey?: string;
    } = {},
  ): Promise<T> {
    const {
      timeout = this.defaultTimeoutMs,
      retries = this.defaultAttempts,
      budgetMs = this.defaultBudgetMs,
      idempotencyKey,
      ...fetchOptions
    } = options;

    const method = String(fetchOptions.method ?? 'GET').toUpperCase();
    const label = `${method} ${describeTarget(url)}`;
    const deadline = Date.now() + budgetMs;

    if (idempotencyKey) {
      fetchOptions.headers = { ...(fetchOptions.headers as Record<string, string>), 'Idempotency-Key': idempotencyKey };
    }

    let attempt = 0;
    let lastError: MarketplaceHttpError | undefined;

    while (attempt < retries) {
      attempt++;

      // Never let one attempt run past the call's budget; a 5s attempt with 3s
      // left gets 3s, and no attempt starts once the budget is spent.
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), Math.min(timeout, remaining));

      try {
        const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
        clearTimeout(id);

        if (!response.ok) {
          // The body usually explains why far better than the status text does,
          // so it travels with the error instead of being discarded.
          const body = await response.text().catch(() => '');
          throw new MarketplaceHttpError(
            `${label} → ${response.status} ${response.statusText}`.trim(),
            HttpStatus.BAD_GATEWAY,
            response.status,
            body.slice(0, 2000),
          );
        }

        // A 204 or an empty body is a valid answer for write endpoints.
        const text = await response.text();
        if (!text) return undefined as T;

        try {
          return JSON.parse(text) as T;
        } catch {
          // A gateway or a login page answering 200 with HTML used to surface as
          // a raw SyntaxError with no status, which then looked retryable and
          // burned three attempts on a page that will never be JSON.
          throw new MarketplaceHttpError(
            `${label} → ${response.status} ancak yanıt JSON değil: ${summariseBody(text)}`,
            HttpStatus.BAD_GATEWAY,
            response.status,
            text.slice(0, 2000),
          );
        }
      } catch (error: any) {
        clearTimeout(id);

        if (error instanceof MarketplaceHttpError) {
          lastError = error;
        } else {
          const failure = classifyTransportFailure(error);
          lastError = new MarketplaceHttpError(
            `${label} → ${describeFailure(failure, error)}`,
            failure === 'timeout' ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY,
            undefined,
            undefined,
            failure,
          );
        }

        // Hammering a marketplace with a request it already rejected can get the
        // seller account rate-limited or blocked, so only retry what can heal.
        const canRetry = isRetryable(
          lastError.failureKind,
          lastError.upstreamStatus,
          method,
          Boolean(idempotencyKey),
        );
        if (!canRetry || attempt >= retries) throw lastError;

        const backoff = Math.min(200 * attempt, Math.max(0, deadline - Date.now()));
        if (backoff <= 0) throw lastError;
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    throw (
      lastError ??
      new MarketplaceHttpError(
        `${describeTarget(url)} → süre bütçesi doldu`,
        HttpStatus.GATEWAY_TIMEOUT,
        undefined,
        undefined,
        'timeout',
      )
    );
  }
}

/** Path only: a query string can carry a seller identifier into the logs. */
function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url.split('?')[0];
  }
}

/** Names the failure in words a seller can act on, not "fetch failed". */
function describeFailure(failure: TransportFailure, error: any): string {
  const detail = error?.cause?.message || error?.message || '';

  switch (failure) {
    case 'timeout':
      return 'istek zaman aşımına uğradı';
    case 'protocol':
      return `sunucu geçersiz bir HTTP yanıtı döndürdü (${detail || 'protokol hatası'})`;
    case 'tls':
      return `TLS/sertifika doğrulaması başarısız (${detail || 'sertifika hatası'})`;
    case 'dns':
      return `sunucu adı çözümlenemedi (${detail || 'DNS hatası'})`;
    case 'url':
      return `geçersiz adres (${detail || 'URL hatası'})`;
    case 'reset':
      return `bağlantı koptu (${detail || 'connection reset'})`;
    default:
      return `bağlantı kurulamadı (${detail || 'bilinmeyen ağ hatası'})`;
  }
}
