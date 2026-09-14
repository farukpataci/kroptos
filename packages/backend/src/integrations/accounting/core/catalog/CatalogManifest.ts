/**
 * K7 — Serbest SQL yok, adlandırılmış katalog var.
 * Sunucu `queryId` + parametre yollar; SQL METNİ GÖNDERMEZ. SQL, Agent'ın imzalı kurulum
 * paketiyle gelir. Bu dosya sözleşmeyi ve salt-okunur doğrulayıcıyı tanımlar; Agent da aynı
 * doğrulayıcıyı kullanır (katalog dosyasında SELECT/WITH dışı ifade varsa Agent BAŞLAMAZ).
 */
import { CatalogQueryRejectedError, CatalogSchemaDriftError } from '../AccountingErrors';
import { readOnlySqlViolation } from './readonly-sql';

export { readOnlySqlViolation } from './readonly-sql';

export type CatalogParamType = 'string' | 'number' | 'boolean' | 'date';

export interface CatalogParamSpec {
  name: string;
  type: CatalogParamType;
  required: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  /** string için izin verilen kalıp (regex kaynağı) */
  pattern?: string;
}

export interface CatalogQuerySpec {
  queryId: string;
  params: CatalogParamSpec[];
  /** Takma adlar (`SELECT ... AS product_code`) — gerçek ERP kolon adları burada GÖRÜNMEZ */
  expectedColumns: string[];
  maxRows: number;
  timeoutSec: number;
}

export interface CatalogManifest {
  provider: string;
  version: string;
  queries: CatalogQuerySpec[];
}

export function resolveQuery(manifest: CatalogManifest, queryId: string): CatalogQuerySpec {
  const spec = manifest.queries.find((q) => q.queryId === queryId);
  if (!spec) throw new CatalogQueryRejectedError(`'${queryId}' manifest'te yok`);
  return spec;
}

/**
 * Parametreler tip ve uzunluk doğrulamasından geçer; tanımsız parametre reddedilir.
 * Dönen nesne yalnızca spec'teki adları içerir — string birleştirme yapan bir kod zaten yoktur,
 * Agent parametreleri sürücüye BAĞLI parametre olarak verir.
 */
export function validateCatalogParams(
  spec: CatalogQuerySpec,
  params: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  const given = params ?? {};
  const known = new Set(spec.params.map((p) => p.name));
  for (const k of Object.keys(given)) {
    if (!known.has(k)) throw new CatalogQueryRejectedError(`'${spec.queryId}' tanımsız parametre: ${k}`);
  }
  const out: Record<string, string | number | boolean> = {};
  for (const p of spec.params) {
    const v = given[p.name];
    if (v === undefined || v === null || v === '') {
      if (p.required) throw new CatalogQueryRejectedError(`'${spec.queryId}' zorunlu parametre eksik: ${p.name}`);
      continue;
    }
    switch (p.type) {
      case 'number': {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n)) throw new CatalogQueryRejectedError(`${p.name} sayı olmalı`);
        if (p.min !== undefined && n < p.min) throw new CatalogQueryRejectedError(`${p.name} < ${p.min}`);
        if (p.max !== undefined && n > p.max) throw new CatalogQueryRejectedError(`${p.name} > ${p.max}`);
        out[p.name] = n;
        break;
      }
      case 'boolean':
        if (typeof v !== 'boolean') throw new CatalogQueryRejectedError(`${p.name} boolean olmalı`);
        out[p.name] = v;
        break;
      case 'date': {
        const s = String(v);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new CatalogQueryRejectedError(`${p.name} YYYY-MM-DD olmalı`);
        out[p.name] = s;
        break;
      }
      case 'string':
      default: {
        if (typeof v !== 'string') throw new CatalogQueryRejectedError(`${p.name} metin olmalı`);
        const max = p.maxLength ?? 256;
        if (v.length > max) throw new CatalogQueryRejectedError(`${p.name} uzunluğu > ${max}`);
        if (p.pattern && !new RegExp(p.pattern).test(v)) {
          throw new CatalogQueryRejectedError(`${p.name} kalıba uymuyor`);
        }
        out[p.name] = v;
      }
    }
  }
  return out;
}

/**
 * Beklenen kolon yoksa akış DURUR — boş sonuçla devam etmez.
 * Boş sonuç kümesinde kolon doğrulanamaz; o zaman sürücünün verdiği kolon listesi kullanılır.
 */
export function assertExpectedColumns(
  spec: CatalogQuerySpec,
  rows: Array<Record<string, unknown>>,
  columnsFromDriver?: string[],
): void {
  const present = new Set<string>(
    columnsFromDriver ?? (rows.length ? Object.keys(rows[0]) : []),
  );
  if (!columnsFromDriver && rows.length === 0) {
    throw new CatalogSchemaDriftError(spec.queryId, spec.expectedColumns);
  }
  const missing = spec.expectedColumns.filter((c) => !present.has(c));
  if (missing.length) throw new CatalogSchemaDriftError(spec.queryId, missing);
}

/**
 * Salt-okunur SQL doğrulayıcı: yalnızca SELECT/WITH ile başlar; `;`, `--`, `/*`, EXEC, DDL/DML → reddet.
 * Kural `readonly-sql.ts`'te (çerçevesiz) yaşar; Agent aynı dosyayı kullanır.
 */
export function assertReadOnlySql(sql: string, queryId = '?'): void {
  const violation = readOnlySqlViolation(sql);
  if (violation) throw new CatalogQueryRejectedError(`${queryId}: ${violation}`);
}
