import { PennylaneWindowLimiter } from './pennylane.window-limiter';

describe('PennylaneWindowLimiter (§2.3, §5.3, §9.6, §9.7)', () => {
  let virtualTime = 1000000;
  let sleepLog: number[] = [];

  const createLimiter = () => {
    virtualTime = 1000000;
    sleepLog = [];
    return new PennylaneWindowLimiter({
      windowMs: 5000,
      maxRequests: 25,
      nowFn: () => virtualTime,
      sleepFn: async (ms: number) => {
        sleepLog.push(ms);
        virtualTime += ms;
      },
    });
  };

  it('ilk 25 isteği beklemeden geçirmeli (§9.6)', async () => {
    const limiter = createLimiter();

    for (let i = 0; i < 25; i++) {
      expect(limiter.canPassImmediately()).toBe(true);
      await limiter.acquire();
    }

    expect(limiter.getCurrentWindowCount()).toBe(25);
    expect(limiter.getRemainingRequests()).toBe(0);
    expect(limiter.canPassImmediately()).toBe(false);
    expect(sleepLog.length).toBe(0);
  });

  it('26. istek pencere dolduğunda bekletilmeli ve kayan pencere korunmalı (§9.6)', async () => {
    const limiter = createLimiter();

    // İstek 0 t = 1_000_000
    await limiter.acquire();

    // İstek 1..24 t = 1_000_500 (500 ms sonra)
    virtualTime = 1000500;
    for (let i = 1; i < 25; i++) {
      await limiter.acquire();
    }

    expect(limiter.canPassImmediately()).toBe(false);
    expect(limiter.getCurrentWindowCount()).toBe(25);

    // 26. istek: İlk istek (1_000_000) 5000 ms'si dolana kadar beklemeli (1_000_000 + 5000 - 1_000_500 = 4500 ms)
    await limiter.acquire();

    expect(sleepLog.length).toBe(1);
    expect(sleepLog[0]).toBe(4500);
    expect(virtualTime).toBe(1005000);
    // İstek 0 düştü, 1..24 (1_000_500'deki 24 istek) + yeni istek = 25
    expect(limiter.getCurrentWindowCount()).toBe(25);
  });

  it('kayan pencere ilerledikçe eski istekler pencereden düşmeli', async () => {
    const limiter = createLimiter();

    for (let i = 0; i < 15; i++) {
      await limiter.acquire();
    }

    virtualTime += 3000; // 3 saniye geçti

    for (let i = 0; i < 10; i++) {
      await limiter.acquire();
    }

    expect(limiter.getCurrentWindowCount()).toBe(25);
    expect(limiter.canPassImmediately()).toBe(false);

    // İlk 15 isteğin 5 saniyelik süresi dolduğunda (3000 + 2001 ms)
    virtualTime += 2001;

    expect(limiter.getCurrentWindowCount()).toBe(10);
    expect(limiter.getRemainingRequests()).toBe(15);
    expect(limiter.canPassImmediately()).toBe(true);
  });

  it('Retry-After başlığını saniye olarak doğru ayrıştırmalı (§9.7)', () => {
    expect(PennylaneWindowLimiter.computeRetryWaitMs('4', null, 1)).toBe(4000);
    expect(PennylaneWindowLimiter.computeRetryWaitMs('10', null, 1)).toBe(10000);
  });

  it('ratelimit-reset unix zaman damgasını doğru hesaplamalı (§9.7)', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const resetSec = String(nowSec + 4);
    const waitMs = PennylaneWindowLimiter.computeRetryWaitMs(null, resetSec, 1);
    expect(waitMs).toBeGreaterThanOrEqual(3000);
    expect(waitMs).toBeLessThanOrEqual(5000);
  });

  it('başlık yoksa üstel geri çekilme uygulamalı', () => {
    const wait = PennylaneWindowLimiter.computeRetryWaitMs(null, null, 2, {
      baseMs: 500,
      maxMs: 5000,
      rng: () => 0.5,
    });
    expect(wait).toBe(500);
  });
});
