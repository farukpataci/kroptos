import {
  ExactBudgetState,
  ExactJobPriority,
  ExactRateLimitHeaders,
} from './exact.types';

export interface ExactExecutionCheckResult {
  allowed: boolean;
  reason?: 'DAILY_QUOTA_EXHAUSTED' | 'WRITE_RESERVE_PROTECTED' | 'MINUTELY_THROTTLED';
  waitMs?: number;
  resetEpochMs?: number;
  message?: string;
}

export class ExactBudgetManager {
  private static instance: ExactBudgetManager;

  // Bölüm bazında bütçe durumu
  private divisionStates: Map<string, ExactBudgetState> = new Map();

  // Bölüm bazında Mutex kuyruk zincirleri (Eşzamanlılık 1 - §5.2)
  private divisionLocks: Map<string, Promise<void>> = new Map();

  // Varsayılan muhafazakâr başlangıç değerleri (§3.3)
  private readonly defaultMinutelyLimit = 60;
  private readonly defaultDailyLimit = 5000;
  private readonly defaultWriteReserve = 1000; // Yazma işlemleri (fatura, tahsilat) için korunan rezerv (§2.1.3)

  constructor(private readonly customWriteReserve?: number) {}

  static getInstance(): ExactBudgetManager {
    if (!ExactBudgetManager.instance) {
      ExactBudgetManager.instance = new ExactBudgetManager();
    }
    return ExactBudgetManager.instance;
  }

  /**
   * Bölümün güncel bütçe durumunu döner. Henüz header görülmediyse varsayılan tahminle ilklendirir.
   */
  getBudgetState(division: string | number): ExactBudgetState {
    const divKey = String(division);
    let state = this.divisionStates.get(divKey);
    if (!state) {
      const now = Date.now();
      // Varsayılan reset: 24 saat sonraki gece yarısı UTC
      const nextMidnight = new Date();
      nextMidnight.setUTCHours(24, 0, 0, 0);
      state = {
        division: divKey,
        minutelyLimit: this.defaultMinutelyLimit,
        minutelyRemaining: this.defaultMinutelyLimit,
        dailyLimit: this.defaultDailyLimit,
        dailyRemaining: this.defaultDailyLimit,
        resetEpochMs: nextMidnight.getTime(),
        lastUpdated: now,
      };
      this.divisionStates.set(divKey, state);
    }
    return { ...state };
  }

  /**
   * Gelen HTTP yanıt başlıklarından kota bilgilerini okur ve bölüm durumunu günceller (§3.3 & §5.1).
   * X-RateLimit-Reset kesinlikle UTC epoch MİLİSANİYE olarak saklanır.
   */
  updateFromHeaders(
    division: string | number,
    headers: Record<string, string | number | undefined> | ExactRateLimitHeaders,
  ): ExactBudgetState {
    const divKey = String(division);
    const currentState = this.getBudgetState(divKey);

    let minLimit: number | undefined;
    let minRem: number | undefined;
    let dayLimit: number | undefined;
    let dayRem: number | undefined;
    let resetEpochMs: number | undefined;

    const raw = headers as Record<string, any>;

    // Hem camelCase hem HTTP başlık formatını (büyük/küçük harf duyarsız) destekler
    for (const key of Object.keys(raw)) {
      const lower = key.toLowerCase();
      const val = raw[key];
      if (val === undefined || val === null) continue;
      const numVal = typeof val === 'number' ? val : parseInt(String(val), 10);
      if (isNaN(numVal)) continue;

      if (lower === 'x-ratelimit-minutely-limit' || lower === 'minutelylimit') minLimit = numVal;
      else if (lower === 'x-ratelimit-minutely-remaining' || lower === 'minutelyremaining') minRem = numVal;
      else if (lower === 'x-ratelimit-limit' || lower === 'dailylimit') dayLimit = numVal;
      else if (lower === 'x-ratelimit-remaining' || lower === 'dailyremaining') dayRem = numVal;
      else if (lower === 'x-ratelimit-reset' || lower === 'resetepochms') {
        // §5.1: X-RateLimit-Reset UTC epoch MİLİSANİYEDİR
        resetEpochMs = numVal;
      }
    }

    const updatedState: ExactBudgetState = {
      division: divKey,
      minutelyLimit: minLimit ?? currentState.minutelyLimit,
      minutelyRemaining: minRem ?? currentState.minutelyRemaining,
      dailyLimit: dayLimit ?? currentState.dailyLimit,
      dailyRemaining: dayRem ?? currentState.dailyRemaining,
      resetEpochMs: resetEpochMs ?? currentState.resetEpochMs,
      lastUpdated: Date.now(),
    };

    this.divisionStates.set(divKey, updatedState);
    return { ...updatedState };
  }

  /**
   * §2.1.3 & §2.1.2: Bir işi çalıştırmadan önce bütçe yeterliliğini önceden denetler.
   * - Günlük bütçe yetersizse işi başlatmaz, erteleme kararı verir.
   * - Okuma (READ) işleri yazma rezervine (WRITE_RESERVE) dokunamaz.
   */
  canExecute(
    division: string | number,
    estimatedCalls: number = 1,
    priority: ExactJobPriority = 'WRITE',
  ): ExactExecutionCheckResult {
    const state = this.getBudgetState(division);
    const now = Date.now();
    const writeReserve = this.customWriteReserve ?? this.defaultWriteReserve;

    // 1. Günlük Kota Tükendi Kontrolü
    if (state.dailyRemaining < estimatedCalls) {
      const waitMs = Math.max(0, state.resetEpochMs - now);
      return {
        allowed: false,
        reason: 'DAILY_QUOTA_EXHAUSTED',
        waitMs,
        resetEpochMs: state.resetEpochMs,
        message: `Exact Online bölüm (${division}) günlük çağrı kotası tükendi (${state.dailyRemaining}/${state.dailyLimit}). Reset zamanı: ${new Date(state.resetEpochMs).toISOString()} (Kalan: ${Math.round(waitMs / 60000)} dk).`,
      };
    }

    // 2. Yazma Rezervi Koruması (Okuma işleri rezervi yiyemez - §2.1.3)
    if (priority === 'READ') {
      const availableForRead = Math.max(0, state.dailyRemaining - writeReserve);
      if (availableForRead < estimatedCalls) {
        const waitMs = Math.max(0, state.resetEpochMs - now);
        return {
          allowed: false,
          reason: 'WRITE_RESERVE_PROTECTED',
          waitMs,
          resetEpochMs: state.resetEpochMs,
          message: `Exact Online okuma işi ertelendi: Günlük bütçeden kalan ${state.dailyRemaining} çağrının ${writeReserve} adedi fatura/tahsilat yazma işlemleri için rezerve edilmiştir.`,
        };
      }
    }

    // 3. Dakikalık Kota Tükendi Kontrolü
    if (state.minutelyRemaining < 1) {
      return {
        allowed: false,
        reason: 'MINUTELY_THROTTLED',
        waitMs: 60000,
        message: `Exact Online dakikalık hız sınırı aşıldı (kalan: ${state.minutelyRemaining}/${state.minutelyLimit}). Bir sonraki dakikaya kadar bekleniyor.`,
      };
    }

    return { allowed: true };
  }

  /**
   * §5.2: Bölüm başına Eşzamanlılık 1 (Sequential Execution).
   * Aynı bölüme ait istekler kuyruğa alınır ve sırayla çalıştırılır.
   */
  async runSequential<T>(
    division: string | number,
    operation: () => Promise<T>,
  ): Promise<T> {
    const divKey = String(division);
    const currentLock = this.divisionLocks.get(divKey) || Promise.resolve();

    let releaseLock: () => void;
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Zincirleme kilidi güncelle
    this.divisionLocks.set(
      divKey,
      currentLock.then(() => nextLock).catch(() => nextLock),
    );

    await currentLock;
    try {
      return await operation();
    } finally {
      releaseLock!();
    }
  }

  /**
   * Mock / Test sıfırlaması
   */
  reset(division?: string | number): void {
    if (division !== undefined) {
      this.divisionStates.delete(String(division));
      this.divisionLocks.delete(String(division));
    } else {
      this.divisionStates.clear();
      this.divisionLocks.clear();
    }
  }
}
