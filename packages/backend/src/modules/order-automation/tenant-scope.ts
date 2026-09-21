import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';

/**
 * Bir otomasyon sorgusunun filtreleneceği, doğrulanmış kiracı bağlamı.
 *
 * Yalnız TenantMiddleware'in çözüp yetkilendirdiği değerlerden okunur — ham
 * `x-agency-id` başlığından asla. Ham başlık doğrulanmamış istemci girdisidir
 * ve çağıranın rolü olmayan bir ajansta filtre kurmasına izin verirdi.
 */
export interface TenantScope {
  agencyId: string;
  clientId: string | null;
  storeId: string | null;
  ruleWhere(): { agencyId: string; storeId?: string };
  runWhere(): { agencyId: string; storeId?: string };
  createData(): { agencyId: string; clientId: string | null; storeId: string };
}

export function tenantScopeFrom(req: Request): TenantScope {
  const activeAgency = (req as any).activeAgency;
  const activeClient = (req as any).activeClient;
  const activeStore = (req as any).activeStore;

  if (!activeAgency?.id) {
    throw new BadRequestException('Aktif kiracı bağlamı gerekli (x-agency-id başlığı).');
  }

  const agencyId = activeAgency.id;
  const clientId = activeClient?.id ?? null;
  const storeId = activeStore?.id ?? null;

  return {
    agencyId,
    clientId,
    storeId,
    ruleWhere() {
      return {
        agencyId,
        ...(storeId ? { storeId } : {}),
      };
    },
    runWhere() {
      return {
        agencyId,
        ...(storeId ? { storeId } : {}),
      };
    },
    createData() {
      if (!storeId) {
        throw new BadRequestException('Bu işlem için mağaza seçimi gerekli (x-store-id başlığı).');
      }
      return {
        agencyId,
        clientId,
        storeId,
      };
    },
  };
}

/**
 * Yazma işleminin gerektirdiği mağaza.
 *
 * Otomasyon kuralları mağaza bazlıdır: mağaza seçilmeden kaydedilen bir kural
 * hangi siparişlere uygulanacağını bilmez.
 */
export function requireStore(scope: TenantScope): string {
  if (!scope.storeId) {
    throw new BadRequestException('Bu işlem için mağaza seçimi gerekli (x-store-id başlığı).');
  }
  return scope.storeId;
}

/**
 * Okuma sorgularının `where` bloğuna gömülecek kiracı filtresi.
 */
export function scopeWhere(scope: TenantScope) {
  return {
    agencyId: scope.agencyId,
    ...(scope.clientId ? { clientId: scope.clientId } : {}),
    ...(scope.storeId ? { storeId: scope.storeId } : {}),
  };
}

export function createTenantScopeMock(overrides?: Partial<TenantScope>): TenantScope {
  const agencyId = overrides?.agencyId ?? 'test-agency';
  const clientId = overrides?.clientId ?? 'test-client';
  const storeId = overrides?.storeId ?? 'test-store';
  return {
    agencyId,
    clientId,
    storeId,
    ruleWhere: overrides?.ruleWhere ?? (() => ({ agencyId, ...(storeId ? { storeId } : {}) })),
    runWhere: overrides?.runWhere ?? (() => ({ agencyId, ...(storeId ? { storeId } : {}) })),
    createData: overrides?.createData ?? (() => {
      if (!storeId) throw new BadRequestException('storeId required');
      return { agencyId, clientId, storeId };
    }),
  };
}

