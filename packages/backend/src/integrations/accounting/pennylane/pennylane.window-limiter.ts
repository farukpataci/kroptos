export interface PennylaneWindowLimiterOptions {
  windowMs?: number; // default: 5000 ms (5 seconds)
  maxRequests?: number; // default: 25 requests per window
  nowFn?: () => number;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  rng?: () => number;
}

/**
 * Pennylane Sliding Window Rate Limiter (§2.3, §5.3, §9.6)
 *
 * Pennylane API v2, 5 saniyelik pencerelerde 25 istek sınırını uygular.
 * Bu bir kayan pencere (sliding window) mekanizmasıdır; saniyede 5 istek diye DÜZLENEMEZ.
 * 25 istek anında gönderilebilir; 26. istek ilk isteğin 5000 ms süresi dolana kadar bekletilir.
 * Limit TOKEN düzeyindedir (her kiracı kendi bağımsız limitine sahiptir).
 */
export class PennylaneWindowLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly nowFn: () => number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private requestTimestamps: number[] = [];

  constructor(options: PennylaneWindowLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? 5000;
    this.maxRequests = options.maxRequests ?? 25;
    this.nowFn = options.nowFn ?? (() => Date.now());
    this.sleepFn =
      options.sleepFn ??
      ((ms: number) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        }));
  }

  /**
   * İstek gönderme izni alır. 5 saniyede 25 istek dolmuşsa kayan pencere boşalana kadar bekler.
   */
  async acquire(): Promise<void> {
    while (true) {
      const now = this.nowFn();
      this.prune(now);

      if (this.requestTimestamps.length < this.maxRequests) {
        this.requestTimestamps.push(now);
        return;
      }

      // Aktif penceredeki en eski istek zamanı
      const oldest = this.requestTimestamps[0];
      const waitMs = oldest + this.windowMs - now;

      if (waitMs > 0) {
        await this.sleepFn(waitMs);
      } else {
        await this.sleepFn(1);
      }
    }
  }

  canPassImmediately(): boolean {
    const now = this.nowFn();
    this.prune(now);
    return this.requestTimestamps.length < this.maxRequests;
  }

  getCurrentWindowCount(): number {
    const now = this.nowFn();
    this.prune(now);
    return this.requestTimestamps.length;
  }

  getRemainingRequests(): number {
    return Math.max(0, this.maxRequests - this.getCurrentWindowCount());
  }

  reset(): void {
    this.requestTimestamps = [];
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > cutoff);
  }

  /**
   * 429 yanıtlarında Retry-After header'ı, ratelimit-reset unix zaman damgası veya üstel geri çekilme hesaplar (§9.7).
   */
  static computeRetryWaitMs(
    retryAfterHeader?: string | null,
    ratelimitResetHeader?: string | null,
    attempt = 1,
    options: BackoffOptions = {},
  ): number {
    if (retryAfterHeader) {
      const parsedSeconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
        return parsedSeconds * 1000;
      }
      const parsedDate = Date.parse(retryAfterHeader);
      if (!isNaN(parsedDate)) {
        const diff = parsedDate - Date.now();
        return diff > 0 ? diff : 1000;
      }
    }

    if (ratelimitResetHeader) {
      // Pennylane ratelimit-reset: unix zaman damgası (saniye cinsinden)
      const resetSec = parseInt(ratelimitResetHeader, 10);
      if (!isNaN(resetSec) && resetSec > 0) {
        const nowSec = Math.floor(Date.now() / 1000);
        const diffSec = resetSec - nowSec;
        if (diffSec > 0) {
          return diffSec * 1000;
        }
      }
    }

    // Fallback: Exponential backoff with jitter
    const baseMs = options.baseMs ?? 500;
    const maxMs = options.maxMs ?? 10000;
    const rng = options.rng ?? Math.random;

    if (attempt <= 0) return 0;
    const exp = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
    const jitter = Math.floor(rng() * exp);
    return Math.min(maxMs, Math.max(baseMs, jitter));
  }
}
