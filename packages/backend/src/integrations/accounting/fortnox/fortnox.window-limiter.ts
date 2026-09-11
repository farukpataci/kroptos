export interface FortnoxWindowLimiterOptions {
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
 * Fortnox Sliding Window Rate Limiter (§5.3)
 * Fortnox enforces 25 requests per 5-second window (~300 req/min).
 * This is a sliding window bucket, NOT smoothed to 5 requests per second.
 * A client can send 25 requests instantly in a burst; the 26th request will
 * wait until the oldest request in the window expires.
 */
export class FortnoxWindowLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly nowFn: () => number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private requestTimestamps: number[] = [];

  constructor(options: FortnoxWindowLimiterOptions = {}) {
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
   * Acquire permission to execute a request.
   * If 25 requests have already occurred within the last 5000 ms,
   * this will pause execution until the sliding window frees up capacity.
   */
  async acquire(): Promise<void> {
    while (true) {
      const now = this.nowFn();
      this.prune(now);

      if (this.requestTimestamps.length < this.maxRequests) {
        this.requestTimestamps.push(now);
        return;
      }

      // Oldest timestamp in current window
      const oldest = this.requestTimestamps[0];
      const waitMs = oldest + this.windowMs - now;

      if (waitMs > 0) {
        await this.sleepFn(waitMs);
      } else {
        // Safe fallback in case clock resolution was 0
        await this.sleepFn(1);
      }
    }
  }

  /**
   * Returns whether a request can pass immediately without waiting.
   */
  canPassImmediately(): boolean {
    const now = this.nowFn();
    this.prune(now);
    return this.requestTimestamps.length < this.maxRequests;
  }

  /**
   * Current number of requests inside the active 5-second window.
   */
  getCurrentWindowCount(): number {
    const now = this.nowFn();
    this.prune(now);
    return this.requestTimestamps.length;
  }

  /**
   * Remaining requests allowed in the current window before throttling.
   */
  getRemainingRequests(): number {
    return Math.max(0, this.maxRequests - this.getCurrentWindowCount());
  }

  /**
   * Clears the current window (for test setups).
   */
  reset(): void {
    this.requestTimestamps = [];
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > cutoff);
  }

  /**
   * Parse Retry-After header or compute exponential backoff with jitter (§5.3)
   */
  static computeRetryWaitMs(
    retryAfterHeader: string | null | undefined,
    attempt: number,
    options: BackoffOptions = {},
  ): number {
    if (retryAfterHeader) {
      const parsedSeconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
        return parsedSeconds * 1000;
      }
      // Or HTTP-date format
      const parsedDate = Date.parse(retryAfterHeader);
      if (!isNaN(parsedDate)) {
        const diff = parsedDate - Date.now();
        return diff > 0 ? diff : 1000;
      }
    }

    // Fallback to exponential backoff with jitter
    const baseMs = options.baseMs ?? 500;
    const maxMs = options.maxMs ?? 10000;
    const rng = options.rng ?? Math.random;

    if (attempt <= 0) return 0;
    const exp = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
    const jitter = Math.floor(rng() * exp);
    return Math.min(maxMs, Math.max(baseMs, jitter));
  }
}
