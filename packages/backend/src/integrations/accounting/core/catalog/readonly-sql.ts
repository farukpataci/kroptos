/**
 * Salt-okunur SQL doğrulayıcı — ÇERÇEVESİZ (Nest import'u yok) ki Agent aynı dosyayı kullanabilsin.
 * Sunucu ve Agent aynı kuralı çalıştırır (K7): tek kaynak, iki kopya değil.
 */
const FORBIDDEN_SQL =
  /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|INTO|xp_\w+|sp_\w+)\b/i;

/** İhlal varsa açıklamasını, yoksa null döner. */
export function readOnlySqlViolation(sql: string): string | null {
  const text = String(sql ?? '').trim();
  if (!text) return 'boş SQL';
  if (!/^(SELECT|WITH)\b/i.test(text)) return 'yalnızca SELECT/WITH ile başlayabilir';
  if (text.includes(';')) return "';' yasak";
  if (text.includes('--')) return "'--' yasak";
  if (text.includes('/*')) return "'/*' yasak";
  const hit = text.match(FORBIDDEN_SQL);
  if (hit) return `'${hit[1]}' yasak`;
  return null;
}
