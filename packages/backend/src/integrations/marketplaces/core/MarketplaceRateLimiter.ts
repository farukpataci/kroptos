import { Injectable } from '@nestjs/common';

@Injectable()
export class MarketplaceRateLimiter {
  private lastRequestTimes: Map<string, number[]> = new Map();

  /**
   * Asserts/delays execution to respect the rate limit of a marketplace provider.
   * @param provider The marketplace provider name (e.g., TRENDYOL)
   * @param maxRequests Maximum requests allowed in the limit window
   * @param windowMs The sliding window in milliseconds (default 1 minute)
   */
  async throttle(provider: string, maxRequests: number = 100, windowMs: number = 60000): Promise<void> {
    const now = Date.now();
    if (!this.lastRequestTimes.has(provider)) {
      this.lastRequestTimes.set(provider, []);
    }

    const times = this.lastRequestTimes.get(provider)!;
    
    // Filter out timestamps older than the sliding window
    const validTimes = times.filter((t) => now - t < windowMs);
    
    if (validTimes.length >= maxRequests) {
      // Find the oldest request time in current window, and compute the sleep duration
      const oldestTime = validTimes[0];
      const sleepTime = windowMs - (now - oldestTime);
      if (sleepTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, sleepTime));
      }
      // Re-run filter/throttle recursively after sleep
      return this.throttle(provider, maxRequests, windowMs);
    }

    validTimes.push(Date.now());
    this.lastRequestTimes.set(provider, validTimes);
  }
}
