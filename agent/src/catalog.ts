import * as fs from 'fs';
import * as path from 'path';
import { readOnlySqlViolation } from './protocol';

/**
 * K7 — Katalog: imzalı kurulum paketiyle gelen, adlandırılmış, parametreli, SALT OKUNUR sorgular.
 * Sunucu SQL metni göndermez; queryId + parametre yollar. Katalog dosyasında SELECT/WITH dışı
 * ifade varsa Agent YÜKLEMEYİ REDDEDER VE BAŞLAMAZ (§9.6).
 *
 * `.sql` yoksa ama `.sql.template` varsa sorgu "tanımlı ama SQL'i doğrulanmamış" sayılır:
 * gerçek Mikro tablo/kolon adları uydurulmaz (§11); Faz D'de `.sql` yazılır.
 */
export interface CatalogEntry {
  queryId: string;
  params: Array<{ name: string; type: 'string' | 'number' | 'boolean' | 'date'; required: boolean; maxLength?: number; min?: number; max?: number; pattern?: string }>;
  expectedColumns: string[];
  maxRows: number;
  timeoutSec: number;
  /** null → SQL henüz doğrulanmadı (DOCUMENTATION_REQUIRED) */
  sql: string | null;
}

export class CatalogLoadError extends Error {}

export function loadCatalog(dir: string): Map<string, CatalogEntry> {
  const manifestFile = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestFile)) throw new CatalogLoadError(`manifest yok: ${manifestFile}`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as { queries: Omit<CatalogEntry, 'sql'>[] };
  const out = new Map<string, CatalogEntry>();
  for (const q of manifest.queries) {
    const sqlFile = path.join(dir, `${q.queryId}.sql`);
    let sql: string | null = null;
    if (fs.existsSync(sqlFile)) {
      sql = fs.readFileSync(sqlFile, 'utf8');
      const violation = readOnlySqlViolation(sql);
      if (violation) throw new CatalogLoadError(`${q.queryId}.sql reddedildi: ${violation}`);
    }
    out.set(q.queryId, { ...q, sql });
  }
  return out;
}

/**
 * Parametreler manifest'e göre doğrulanır; STRING BİRLEŞTİRME YOK — sürücüye bağlı parametre
 * olarak verilir (SqlVeriOku sözleşmesi doğrulanana kadar bu nesne olduğu gibi gövdede taşınır).
 */
export function bindParams(entry: CatalogEntry, given: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const g = given ?? {};
  const known = new Set(entry.params.map((p) => p.name));
  for (const k of Object.keys(g)) if (!known.has(k)) throw new CatalogLoadError(`${entry.queryId}: tanımsız parametre ${k}`);
  const out: Record<string, string | number | boolean> = {};
  for (const p of entry.params) {
    const v = g[p.name];
    if (v === undefined || v === null || v === '') {
      if (p.required) throw new CatalogLoadError(`${entry.queryId}: zorunlu parametre eksik ${p.name}`);
      continue;
    }
    if (p.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n) || (p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max)) {
        throw new CatalogLoadError(`${entry.queryId}: ${p.name} geçersiz`);
      }
      out[p.name] = n;
    } else if (p.type === 'boolean') {
      if (typeof v !== 'boolean') throw new CatalogLoadError(`${entry.queryId}: ${p.name} boolean olmalı`);
      out[p.name] = v;
    } else {
      const s = String(v);
      if (s.length > (p.maxLength ?? 256)) throw new CatalogLoadError(`${entry.queryId}: ${p.name} çok uzun`);
      if (p.pattern && !new RegExp(p.pattern).test(s)) throw new CatalogLoadError(`${entry.queryId}: ${p.name} kalıba uymuyor`);
      if (p.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new CatalogLoadError(`${entry.queryId}: ${p.name} tarih değil`);
      out[p.name] = s;
    }
  }
  return out;
}
