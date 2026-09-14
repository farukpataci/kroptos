import * as fs from 'fs';
import * as path from 'path';

/**
 * Yerel tekrar-koruma kasası (§9.5). Tünel koptuğunda çift fatura yazılmamasının TEK panzehiri:
 * aynı idempotencyKey ikinci kez gelirse ERP'ye GİDİLMEZ, saklı sonuç fromCache:true ile döner.
 * TTL 7 gün — daha kısa pencerede uzun süre çevrimdışı kalan Agent eski işleri tekrar çalıştırır.
 */
export interface StoredResult {
  jobId: string;
  status: 'OK' | 'FAILED';
  data?: unknown;
  errorCode?: string;
  completedAt: string; // ISO
}

export class IdempotencyStore {
  private map = new Map<string, StoredResult>();

  constructor(
    private readonly file: string,
    private readonly ttlMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  load(): void {
    if (!fs.existsSync(this.file)) return;
    const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Record<string, StoredResult>;
    this.map = new Map(Object.entries(raw));
    this.purge();
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(Object.fromEntries(this.map)));
  }

  purge(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [k, v] of this.map) if (Date.parse(v.completedAt) < cutoff) this.map.delete(k);
  }

  get(idempotencyKey: string): StoredResult | undefined {
    const v = this.map.get(idempotencyKey);
    if (!v) return undefined;
    if (Date.parse(v.completedAt) < this.now() - this.ttlMs) {
      this.map.delete(idempotencyKey);
      return undefined;
    }
    return v;
  }

  /** Yalnızca KESİN sonuçlar saklanır (OK / FAILED). RETRYABLE saklanmaz — tekrar denenmeli. */
  put(idempotencyKey: string, result: StoredResult): void {
    this.map.set(idempotencyKey, result);
    this.persist();
  }

  get size(): number {
    return this.map.size;
  }
}
