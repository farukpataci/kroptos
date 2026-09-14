import { CompanyKey } from './AccountingTypes';

/**
 * K4 — oturum/cache anahtarı firma eksenini içerir.
 * Token cache, oturum havuzu, throttle sayacı ve yazma kilidi HEPSİ bu anahtarı kullanır.
 * Bağlantı düzeyinde cache'lemek 2 no'lu firmanın kimliğiyle 3 no'lu firmaya kayıt attırır —
 * ve bu hata exception vermez.
 */
export type SessionKey = string;

export function buildSessionKey(integrationId: string, key: CompanyKey): SessionKey {
  if (!integrationId || !key?.companyNo) {
    throw new Error('SessionKey: integrationId ve companyNo zorunlu');
  }
  return `${integrationId}:${key.companyNo}:${key.periodNo || '-'}:${key.branchCode || '-'}`;
}

export function tokenCacheKey(integrationId: string, key: CompanyKey): string {
  return `token:${buildSessionKey(integrationId, key)}`;
}

export function writeLockName(integrationId: string, key: CompanyKey): string {
  return `lock:write:${buildSessionKey(integrationId, key)}`;
}

export function parseSessionKey(sessionKey: SessionKey): { integrationId: string } & CompanyKey {
  const [integrationId, companyNo, periodNo, branchCode] = sessionKey.split(':');
  if (!integrationId || !companyNo) throw new Error(`Geçersiz SessionKey: ${sessionKey}`);
  return {
    integrationId,
    companyNo,
    periodNo: periodNo === '-' ? null : periodNo,
    branchCode: branchCode === '-' ? null : branchCode,
  };
}
