import { LexwareBackoff } from './lexware.backoff';

describe('LexwareBackoff (§3.2, §5.1)', () => {
  it('returns 0 for attempt <= 0', () => {
    expect(LexwareBackoff.calculateBackoffMs(0)).toBe(0);
    expect(LexwareBackoff.calculateBackoffMs(-1)).toBe(0);
  });

  it('calculates jittered exponential backoff with custom RNG', () => {
    // With rng = 1.0 (max jitter), should return exact upper bound: baseMs * 2^(attempt - 1)
    const maxRng = () => 1.0;
    const baseMs = 500;
    const maxMs = 10000;

    const b1 = LexwareBackoff.calculateBackoffMs(1, { baseMs, maxMs, rng: maxRng });
    expect(b1).toBe(500); // 500 * 2^0

    const b2 = LexwareBackoff.calculateBackoffMs(2, { baseMs, maxMs, rng: maxRng });
    expect(b2).toBe(1000); // 500 * 2^1

    const b3 = LexwareBackoff.calculateBackoffMs(3, { baseMs, maxMs, rng: maxRng });
    expect(b3).toBe(2000); // 500 * 2^2

    // With rng = 0.5 (half jitter)
    const halfRng = () => 0.5;
    const halfB2 = LexwareBackoff.calculateBackoffMs(2, { baseMs, maxMs, rng: halfRng });
    expect(halfB2).toBe(500); // floor(0.5 * 1000)
  });

  it('caps backoff at maxMs regardless of high attempt number', () => {
    const maxRng = () => 1.0;
    const b10 = LexwareBackoff.calculateBackoffMs(10, { baseMs: 500, maxMs: 5000, rng: maxRng });
    expect(b10).toBe(5000);
  });

  it('produces variable non-fixed backoff values over multiple invocations (jitter check)', () => {
    const results = new Set<number>();
    for (let i = 0; i < 50; i++) {
      results.add(LexwareBackoff.calculateBackoffMs(3, { baseMs: 500, maxMs: 10000 }));
    }
    // Should have multiple distinct values, proving it is not a fixed delay
    expect(results.size).toBeGreaterThan(10);
  });
});
