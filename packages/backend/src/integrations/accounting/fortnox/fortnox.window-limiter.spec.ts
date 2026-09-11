import { FortnoxWindowLimiter } from './fortnox.window-limiter';

describe('FortnoxWindowLimiter (§5.3 Rate Limit: 25 req / 5 sec sliding window)', () => {
  let virtualTime: number;
  let limiter: FortnoxWindowLimiter;

  beforeEach(() => {
    virtualTime = 1_000_000;
    limiter = new FortnoxWindowLimiter({
      windowMs: 5000,
      maxRequests: 25,
      nowFn: () => virtualTime,
      sleepFn: async (ms: number) => {
        virtualTime += ms;
      },
    });
  });

  it('allows 25 consecutive requests immediately in a burst without per-second smoothing', async () => {
    for (let i = 0; i < 25; i++) {
      expect(limiter.canPassImmediately()).toBe(true);
      await limiter.acquire();
    }

    // All 25 executed at virtualTime = 1_000_000 (0 ms delay)
    expect(virtualTime).toBe(1_000_000);
    expect(limiter.getCurrentWindowCount()).toBe(25);
    expect(limiter.getRemainingRequests()).toBe(0);
    expect(limiter.canPassImmediately()).toBe(false);
  });

  it('blocks the 26th request until the window slides and frees capacity', async () => {
    // Fire request #0 at t = 1_000_000
    await limiter.acquire();

    // Advance 500 ms and fire requests 1..24 at t = 1_000_500
    virtualTime = 1_000_500;
    for (let i = 1; i < 25; i++) {
      await limiter.acquire();
    }

    expect(limiter.canPassImmediately()).toBe(false);
    expect(limiter.getCurrentWindowCount()).toBe(25);

    // 26th request must wait until the first timestamp (1_000_000) expires at 1_005_001
    // Oldest is 1_000_000. Wait = 1_000_000 + 5000 - 1_000_500 = 4500 ms.
    await limiter.acquire();

    expect(virtualTime).toBe(1_005_000);
    // Request #0 has dropped out (> 1_000_000), requests 1..24 remain (at 1_000_500), plus new request at 1_005_000
    // Total inside window = 24 + 1 = 25
    expect(limiter.getCurrentWindowCount()).toBe(25);
  });

  it('gradually frees capacity as timestamps fall outside the 5000 ms window', async () => {
    // Fire 10 requests at t=0
    for (let i = 0; i < 10; i++) {
      await limiter.acquire();
    }
    expect(limiter.getCurrentWindowCount()).toBe(10);

    // Advance 2000 ms
    virtualTime += 2000;

    // Fire 15 requests at t=2000
    for (let i = 0; i < 15; i++) {
      await limiter.acquire();
    }
    expect(limiter.getCurrentWindowCount()).toBe(25);
    expect(limiter.canPassImmediately()).toBe(false);

    // Advance 3001 ms (now t=5001). The first 10 requests should have dropped out
    virtualTime += 3001;
    expect(limiter.getCurrentWindowCount()).toBe(15);
    expect(limiter.getRemainingRequests()).toBe(10);
    expect(limiter.canPassImmediately()).toBe(true);
  });

  describe('computeRetryWaitMs', () => {
    it('parses numeric Retry-After header in seconds', () => {
      expect(FortnoxWindowLimiter.computeRetryWaitMs('3', 1)).toBe(3000);
      expect(FortnoxWindowLimiter.computeRetryWaitMs('10', 1)).toBe(10000);
    });

    it('falls back to jittered exponential backoff when Retry-After is absent', () => {
      const fixedRng = () => 0.8;
      const wait = FortnoxWindowLimiter.computeRetryWaitMs(null, 2, {
        baseMs: 500,
        maxMs: 10000,
        rng: fixedRng,
      });
      // 500 * 2^1 = 1000. Jitter: floor(0.8 * 1000) = 800. Max(500, 800) = 800.
      expect(wait).toBe(800);
    });

    it('returns 0 for attempt <= 0 when Retry-After is absent', () => {
      expect(FortnoxWindowLimiter.computeRetryWaitMs(null, 0)).toBe(0);
    });
  });
});
