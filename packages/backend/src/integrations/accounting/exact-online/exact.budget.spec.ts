import { ExactBudgetManager } from './exact.budget';

describe('ExactBudgetManager (§2.1 & §8.1)', () => {
  let budget: ExactBudgetManager;

  beforeEach(() => {
    budget = new ExactBudgetManager(1000); // 1000 çağrı yazma rezervi
    budget.reset();
  });

  it('1. should read quotas from headers, falling back to defaults only before any header is seen', () => {
    // Header görülmeden önce varsayılanlar
    const initial = budget.getBudgetState(12345);
    expect(initial.minutelyLimit).toBe(60);
    expect(initial.dailyLimit).toBe(5000);

    // Header ile güncelleme
    budget.updateFromHeaders(12345, {
      'X-RateLimit-Minutely-Limit': '60',
      'X-RateLimit-Minutely-Remaining': '45',
      'X-RateLimit-Limit': '30000', // Premium lisans örneği (§3.3)
      'X-RateLimit-Remaining': '29500',
      'X-RateLimit-Reset': '1757592000000',
    });

    const updated = budget.getBudgetState(12345);
    expect(updated.minutelyRemaining).toBe(45);
    expect(updated.dailyLimit).toBe(30000);
    expect(updated.dailyRemaining).toBe(29500);
    expect(updated.resetEpochMs).toBe(1757592000000);
  });

  it('2. should isolate budgets per division: one exhausted division does not affect another', () => {
    const divA = 1001;
    const divB = 1002;

    budget.updateFromHeaders(divA, {
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Date.now() + 3600000),
    });

    budget.updateFromHeaders(divB, {
      'X-RateLimit-Remaining': '4000',
      'X-RateLimit-Reset': String(Date.now() + 3600000),
    });

    const checkA = budget.canExecute(divA, 1, 'WRITE');
    expect(checkA.allowed).toBe(false);
    expect(checkA.reason).toBe('DAILY_QUOTA_EXHAUSTED');

    const checkB = budget.canExecute(divB, 1, 'WRITE');
    expect(checkB.allowed).toBe(true);
  });

  it('3. should NOT start operation if estimated calls exceed remaining daily budget', () => {
    const div = 2001;
    budget.updateFromHeaders(div, {
      'X-RateLimit-Remaining': '50',
      'X-RateLimit-Reset': String(Date.now() + 1800000),
    });

    // 60 çağrı gerektiren toplu iş
    const check = budget.canExecute(div, 60, 'WRITE');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('DAILY_QUOTA_EXHAUSTED');
    expect(check.message).toContain('günlük çağrı kotası tükendi');
  });

  it('4. should protect WRITE reserve: READ operations cannot consume reserved calls', () => {
    const div = 3001;
    // Kalan 1050 çağrı, rezerv 1000. Okuma için müsait = 50 çağrı.
    budget.updateFromHeaders(div, {
      'X-RateLimit-Remaining': '1050',
      'X-RateLimit-Reset': String(Date.now() + 3600000),
    });

    // 60 çağrılık okuma işi rezervi ihlal eder -> reddedilmeli
    const readCheck = budget.canExecute(div, 60, 'READ');
    expect(readCheck.allowed).toBe(false);
    expect(readCheck.reason).toBe('WRITE_RESERVE_PROTECTED');
    expect(readCheck.message).toContain('fatura/tahsilat yazma işlemleri için rezerve edilmiştir');

    // 40 çağrılık okuma işi müsaittir (1050 - 1000 = 50 >= 40)
    const smallRead = budget.canExecute(div, 40, 'READ');
    expect(smallRead.allowed).toBe(true);

    // Aynı kalanla 60 çağrılık YAZMA işi izinlidir (çünkü rezerv yazma içindir)
    const writeCheck = budget.canExecute(div, 60, 'WRITE');
    expect(writeCheck.allowed).toBe(true);
  });

  it('5. should defer operations to X-RateLimit-Reset when daily quota is exhausted (no blind retry)', () => {
    const div = 4001;
    const futureResetMs = Date.now() + 7200000; // 2 saat sonra
    budget.updateFromHeaders(div, {
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(futureResetMs),
    });

    const check = budget.canExecute(div, 1, 'WRITE');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('DAILY_QUOTA_EXHAUSTED');
    expect(check.resetEpochMs).toBe(futureResetMs);
    expect(check.waitMs).toBeGreaterThan(7000000);
  });

  it('6. should strictly interpret X-RateLimit-Reset as MILLISECONDS (would fail if interpreted as seconds)', () => {
    const div = 5001;
    // Bir milisaniye epoch (örn: 1757592000000 ms = ~Sep 2025)
    const epochMs = 1757592000000;
    budget.updateFromHeaders(div, {
      'X-RateLimit-Reset': String(epochMs),
      'X-RateLimit-Remaining': '100',
    });

    const state = budget.getBudgetState(div);
    expect(state.resetEpochMs).toBe(epochMs);
    // Eğer saniye sanılsaydı (epochMs / 1000), 1970'lere düşerdi (1.75 milyar ms)
    expect(state.resetEpochMs).toBeGreaterThan(1000000000000);
  });

  it('7. should indicate MINUTELY_THROTTLED when minutely limit is 0 so caller waits without dropping job', () => {
    const div = 6001;
    budget.updateFromHeaders(div, {
      'X-RateLimit-Minutely-Remaining': '0',
      'X-RateLimit-Remaining': '4000',
    });

    const check = budget.canExecute(div, 1, 'WRITE');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('MINUTELY_THROTTLED');
    expect(check.waitMs).toBe(60000);
  });

  it('8. should enforce concurrency of 1 per division (sequential execution)', async () => {
    const div = 7001;
    const executionOrder: number[] = [];

    const job1 = async () => {
      executionOrder.push(1);
      await new Promise((resolve) => setTimeout(resolve, 50));
      executionOrder.push(2);
      return 'JOB1_DONE';
    };

    const job2 = async () => {
      executionOrder.push(3);
      await new Promise((resolve) => setTimeout(resolve, 10));
      executionOrder.push(4);
      return 'JOB2_DONE';
    };

    // Aynı anda tetikleniyor
    const [res1, res2] = await Promise.all([
      budget.runSequential(div, job1),
      budget.runSequential(div, job2),
    ]);

    expect(res1).toBe('JOB1_DONE');
    expect(res2).toBe('JOB2_DONE');
    // Job 1 tamamen bitmeden Job 2 araya giremez (1, 2, 3, 4 olmalı; 1, 3, 2, 4 olamaz)
    expect(executionOrder).toEqual([1, 2, 3, 4]);
  });
});
