/**
 * Lexware Office Rate Limit Backoff (§3.2, §5.1)
 *
 * Saniyede 2 istek (token bucket), HTTP 429 aşımında Retry-After header'ı YOKTUR.
 * Full Jitter Exponential Backoff (AWS recommendation) uygulanır:
 * sleep = random_between(0, min(maxBackoff, base * 2^attempt))
 *
 * Sabit bekleme kullanılmaz (tüm işlerin aynı anda uyanmasını engeller).
 */

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  rng?: () => number;
}

export class LexwareBackoff {
  private static readonly DEFAULT_BASE_MS = 500;
  private static readonly DEFAULT_MAX_MS = 30000;

  /**
   * Calculates exponential backoff duration with full jitter.
   * @param attempt 1-indexed attempt number (1, 2, 3...)
   * @param options Custom baseMs, maxMs, or deterministic RNG
   * @returns backoff time in milliseconds
   */
  static calculateBackoffMs(attempt: number, options?: BackoffOptions): number {
    const baseMs = options?.baseMs ?? this.DEFAULT_BASE_MS;
    const maxMs = options?.maxMs ?? this.DEFAULT_MAX_MS;
    const rng = options?.rng ?? Math.random;

    if (attempt <= 0) return 0;

    // Exponential upper bound capped at maxMs
    const temp = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));

    // Full jitter: uniformly distributed between 0 and temp (never fixed)
    const jittered = Math.floor(rng() * temp);

    return Math.max(0, jittered);
  }

  /**
   * Sleeps for the jittered backoff duration.
   */
  static async sleep(attempt: number, options?: BackoffOptions): Promise<number> {
    const ms = this.calculateBackoffMs(attempt, options);
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
    return ms;
  }
}
