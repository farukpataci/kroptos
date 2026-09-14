import { createHash } from 'crypto';

/**
 * K8 — `Sifre` = MD5("Tarih + Şifre") (docs/mikro.agent.md §3.2, örnek: `2023-03-09 123asd`).
 * TAM BİÇİM DOĞRULANMADI (§12/1): tarih formatı, ayraç, büyük/küçük harf, saat dilimi.
 * Bu yüzden biçim yapılandırılabilir (`sifreFormat`, varsayılan '{date} {password}') ve
 * türetme HER İSTEKTE yeniden yapılır — CACHE'LENMEZ. Gece yarısı sınırında üretilip sonra
 * gönderilen zarf geçersizdir.
 */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function deriveSifre(password: string, format: string, now: Date): string {
  const material = format.replace('{date}', formatLocalDate(now)).replace('{password}', password);
  return createHash('md5').update(material, 'utf8').digest('hex');
}
