import { AccountingProviderSchema, CredentialFieldDefinition } from './AccountingTypes';

export const isAgentLocal = (f: CredentialFieldDefinition): boolean => f.storage === 'AGENT_LOCAL';
export const isDerived = (f: CredentialFieldDefinition): boolean => !!f.derived;

/** Formda gösterilecek alanlar — derived alanlar GÖSTERİLMEZ (§7.2, test 36). */
export function visibleFields(schema: AccountingProviderSchema): CredentialFieldDefinition[] {
  return schema.fields.filter((f) => !isDerived(f));
}

/** Sunucuda saklanabilecek alanlar — yalnızca SERVER_ENCRYPTED ve türetilmemiş (K2). */
export function serverFields(schema: AccountingProviderSchema): CredentialFieldDefinition[] {
  return schema.fields.filter((f) => !isAgentLocal(f) && !isDerived(f));
}

/**
 * K2 — AGENT_LOCAL ve derived alanlar sunucu kaydından ayıklanır.
 * Şema AGENT_LOCAL alan bildirmiyorsa (klasik bulut sağlayıcı) her şey olduğu gibi kalır;
 * bildiriyorsa yalnızca şemadaki sunucu alanları geçer — sunucu tanımadığı bir sırrı saklamaz.
 */
export function stripNonServerFields(
  schema: AccountingProviderSchema,
  credentials: Record<string, any> | undefined,
): Record<string, any> {
  const hasAgentLocal = schema.fields.some((f) => isAgentLocal(f) || isDerived(f));
  if (!hasAgentLocal) return { ...(credentials ?? {}) };
  const allowed = new Set(serverFields(schema).map((f) => f.key));
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(credentials ?? {})) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

/**
 * K1 — kimlik anahtarı sızıntısı denetimi, iç içe nesnelerde de.
 * Anahtar karşılaştırması büyük/küçük harf duyarsızdır.
 */
export function findCredentialLeak(
  body: unknown,
  forbiddenKeys: readonly string[],
  path = '$',
): string | null {
  if (!body || typeof body !== 'object') return null;
  const forbidden = new Set(forbiddenKeys.map((k) => k.toLowerCase()));
  if (Array.isArray(body)) {
    for (let i = 0; i < body.length; i++) {
      const hit = findCredentialLeak(body[i], forbiddenKeys, `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (forbidden.has(k.toLowerCase())) return `${path}.${k}`;
    const hit = findCredentialLeak(v, forbiddenKeys, `${path}.${k}`);
    if (hit) return hit;
  }
  return null;
}

export function assertNoCredentialLeak(body: unknown, forbiddenKeys: readonly string[]): void {
  const hit = findCredentialLeak(body, forbiddenKeys);
  if (hit) throw new Error(`Kimlik anahtarı sızıntısı: ${hit} (K1)`);
}
