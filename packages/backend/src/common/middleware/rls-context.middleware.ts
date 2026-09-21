import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MutableTenantContext, tenantContextStorage } from '../prisma/tenant-context';

/**
 * İstek için RLS bağlam kapsayıcısını açar (P12 Adım 2). TenantMiddleware'den
 * ÖNCE koşar: kiracı çözümü (header → Agency/Store/UserRole sorguları), JwtStrategy
 * ve PermissionGuard henüz kiracı bilinmeden çalışır; o aşama AÇIKÇA sistem
 * bağlamıdır ("request:pre-auth"). Guard'lar bittikten sonra RlsBindInterceptor
 * aynı nesneyi doğrulanmış aktif ajansa çevirir; controller/servis sorguları o
 * andan itibaren kiracı kilidi altında koşar.
 */
@Injectable()
export class RlsContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    const ctx: MutableTenantContext = { mode: 'system', reason: 'request:pre-auth' };
    tenantContextStorage.run(ctx as any, () => next());
  }
}
