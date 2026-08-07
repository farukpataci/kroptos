import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuditLogService } from './audit.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';
import { Request } from 'express';

// Tenant filtresi TenantMiddleware'in doğruladığı aktif bağlamdan okunur; header
// yoksa JWT'deki agencyId'ye düşer. Daha önce burada ham `x-agency-id` header'ı
// fallback'ti — middleware o header'ı `if/else if` zincirinin agency dalında
// doğruluyor, ama store/client bağlamı da gönderilmişse o dal hiç çalışmıyor.
// Ham header'a hiç dokunmamak bu bağımlılığı tamamen ortadan kaldırıyor.
@Controller('/api/audit-logs')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermission('audit.read')
  async getLogs(@Req() req: Request, @Query() query: any) {
    const tenantId = (req as any).activeAgency?.id ?? (req as any).user?.agencyId;
    if (!tenantId) {
      return { items: [], total: 0 };
    }
    return this.auditLogService.getLogs(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('audit.read')
  async getLogById(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).activeAgency?.id ?? (req as any).user?.agencyId;
    return this.auditLogService.getLogById(tenantId, id);
  }
}
