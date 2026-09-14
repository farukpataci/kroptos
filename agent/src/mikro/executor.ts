import { AgentJob, AgentResult, isWriteJob } from '../protocol';
import { CatalogEntry, bindParams } from '../catalog';
import { deriveSifre } from './sifre';

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface MikroExecutorOptions {
  baseUrl: string;
  port: number;
  sifreFormat: string;
  clockSkewLimitSec: number;
  agentVersion: string;
  catalog: Map<string, CatalogEntry>;
  fetch: FetchLike;
  now?: () => Date;
  log?: (line: string) => void;
}

/** Kimlik zarfı — YALNIZCA burada kurulur (K1). Loglanmaz, cache'lenmez (K8). */
interface MikroEnvelope {
  ApiKey: string;
  KullaniciKodu: string;
  Sifre: string;
  FirmaKodu: string;
  CalismaYili: string;
}

const INVALID_KEY_RE = /Ge[cç]ersiz api key/i;

export class MikroExecutor {
  private readonly now: () => Date;
  private readonly log: (line: string) => void;
  /** Testler: zarf kaç kez türetildi (iki ardışık istekte İKİ kez olmalı) */
  envelopeDerivations = 0;

  constructor(private readonly opts: MikroExecutorOptions) {
    this.now = opts.now ?? (() => new Date());
    this.log = opts.log ?? (() => undefined);
  }

  private get origin(): string {
    return `${this.opts.baseUrl.replace(/\/+$/, '')}:${this.opts.port}`;
  }

  private buildEnvelope(creds: Record<string, string>, job: AgentJob): MikroEnvelope {
    this.envelopeDerivations++;
    // FirmaKodu / CalismaYili işin companyKey'inden; diğer üçü yerel kasadan (§9.6)
    return {
      ApiKey: creds.apiKey,
      KullaniciKodu: creds.kullaniciKodu,
      Sifre: deriveSifre(creds.password, this.opts.sifreFormat, this.now()),
      FirmaKodu: job.companyKey.companyNo,
      CalismaYili: job.companyKey.periodNo ?? '',
    };
  }

  /** K8/§9.6: Mikro farklı makinedeyse Date başlığından saat farkı ölçülür; localhost'ta ölçüm gereksiz. */
  async clockSkewSec(): Promise<number> {
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])$/i.test(this.opts.baseUrl.replace(/\/+$/, ''))) return 0;
    try {
      const r = await this.opts.fetch(this.origin + '/', { method: 'GET', headers: {} });
      const d = r.headers.get('date');
      if (!d) return 0;
      return Math.round(Math.abs(Date.parse(d) - this.now().getTime()) / 1000);
    } catch {
      return 0;
    }
  }

  async execute(job: AgentJob, creds: Record<string, string> | undefined): Promise<AgentResult> {
    const started = Date.now();
    const done = (partial: Omit<AgentResult, 'jobId' | 'durationMs' | 'agentVersion' | 'fromCache'>): AgentResult => ({
      jobId: job.jobId,
      durationMs: Date.now() - started,
      agentVersion: this.opts.agentVersion,
      fromCache: false,
      ...partial,
    });

    if (!creds?.apiKey || !creds?.kullaniciKodu || !creds?.password) {
      return done({ status: 'FAILED', errorCode: 'erp_auth_failed', errorRaw: 'ERP kimliği tanımlı değil (yerel kasa boş)' });
    }

    const skew = await this.clockSkewSec();
    if (skew > this.opts.clockSkewLimitSec) {
      return done({ status: 'FAILED', errorCode: 'erp_clock_skew', errorRaw: `saat farkı ${skew}s > ${this.opts.clockSkewLimitSec}s` });
    }

    const payload = (job.payload ?? {}) as Record<string, unknown>;
    let path: string;
    let body: Record<string, unknown>;

    if (job.type === 'CATALOG_QUERY') {
      const entry = this.opts.catalog.get(String(payload.queryId));
      if (!entry) return done({ status: 'REJECTED', errorCode: 'catalog_query_unknown', errorRaw: String(payload.queryId) });
      if (!entry.sql) return done({ status: 'FAILED', errorCode: 'catalog_query_unavailable', errorRaw: `${entry.queryId}: SQL doğrulanmadı (DOCUMENTATION_REQUIRED)` });
      let params: Record<string, string | number | boolean>;
      try {
        params = bindParams(entry, payload.params as Record<string, unknown>);
      } catch (e: any) {
        return done({ status: 'REJECTED', errorCode: 'catalog_param_rejected', errorRaw: e.message });
      }
      // K7: string birleştirme YOK. SqlVeriOkuV2'nin bağlı parametre desteği DOĞRULANMADI (§12 yeni #12):
      // parametreli sorgular bu doğrulanana kadar çalıştırılmaz.
      if (Object.keys(params).length > 0) {
        return done({ status: 'FAILED', errorCode: 'catalog_binding_unverified', errorRaw: `${entry.queryId}: parametre bağlama sözleşmesi doğrulanmadı` });
      }
      path = '/api/apimethods/SqlVeriOkuV2';
      body = { SQLSorgu: entry.sql };
    } else {
      path = String(payload.path ?? '');
      if (!path.startsWith('/')) return done({ status: 'REJECTED', errorCode: 'job_type_rejected', errorRaw: 'geçersiz yol' });
      body = (payload.body as Record<string, unknown>) ?? {};
    }

    // Kimlik hatasında zarf TAM BİR KEZ yeniden türetilerek denenir (K8) — ikincisinde retry yok
    for (let attempt = 1; attempt <= 2; attempt++) {
      const envelope = this.buildEnvelope(creds, job);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), job.jobTimeoutSec * 1000);
      try {
        const res = await this.opts.fetch(this.origin + path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Mikro: envelope, ...body }),
          signal: controller.signal,
        });
        const text = await res.text();
        if (INVALID_KEY_RE.test(text)) {
          this.log(`[mikro] kimlik reddedildi (deneme ${attempt}) job=${job.jobId}`);
          if (attempt === 1) continue;
          return done({ status: 'FAILED', errorCode: 'erp_auth_failed', errorRaw: 'Geçersiz api key' });
        }
        if (res.status >= 500) return done({ status: 'RETRYABLE', errorCode: 'erp_error', errorRaw: `HTTP ${res.status}` });
        if (res.status >= 400) return done({ status: 'FAILED', errorCode: 'erp_error', errorRaw: `HTTP ${res.status}: ${text.slice(0, 500)}` });
        let data: unknown = text;
        try {
          data = JSON.parse(text);
        } catch {
          /* zarf doğrulanmadı — metin olduğu gibi döner, sunucu tarafı response mapper reddeder */
        }
        return done({ status: 'OK', data });
      } catch (e: any) {
        if (controller.signal.aborted) {
          // Zaman aşımı: yazma işinde sonuç BİLİNMİYOR → sunucu 'stuck' yazar, INVOICE_FIND_BY_REF ile çözer
          return done({ status: isWriteJob(job.type) ? 'FAILED' : 'RETRYABLE', errorCode: 'erp_timeout', errorRaw: `${job.jobTimeoutSec}s` });
        }
        return done({ status: 'RETRYABLE', errorCode: 'erp_unreachable', errorRaw: String(e?.message ?? e).slice(0, 200) });
      } finally {
        clearTimeout(timer);
      }
    }
    return done({ status: 'FAILED', errorCode: 'erp_auth_failed' });
  }
}
