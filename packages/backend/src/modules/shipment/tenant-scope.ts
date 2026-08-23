import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';

/**
 * The validated tenant context a carrier query must be filtered by.
 *
 * Read only from what TenantMiddleware resolved and authorised — never from a
 * raw `x-agency-id` header, which is unverified client input and would let a
 * caller filter on an agency they have no role in.
 */
export interface TenantScope {
  agencyId: string;
  clientId: string | null;
  storeId: string | null;
}

export function tenantScopeFrom(req: Request): TenantScope {
  const activeAgency = (req as any).activeAgency;
  const activeClient = (req as any).activeClient;
  const activeStore = (req as any).activeStore;

  if (!activeAgency?.id) {
    throw new BadRequestException('Aktif kiracı bağlamı gerekli (x-agency-id başlığı).');
  }

  return {
    agencyId: activeAgency.id,
    clientId: activeClient?.id ?? null,
    storeId: activeStore?.id ?? null,
  };
}

/** The store a write needs; carrier shipments are always store-scoped. */
export function requireStore(scope: TenantScope): string {
  if (!scope.storeId) {
    throw new BadRequestException('Bu işlem için mağaza seçimi gerekli (x-store-id başlığı).');
  }
  return scope.storeId;
}
