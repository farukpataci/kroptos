import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuditLogService } from './audit.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Controller('/api/audit-logs')
@UseGuards(AuthGuard('jwt'))
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getLogs(@Req() req: Request, @Query() query: any) {
    const tenantId = (req as any).user?.agencyId || (req.headers['x-agency-id'] as string);
    if (!tenantId) {
      return { items: [], total: 0 };
    }
    return this.auditLogService.getLogs(tenantId, query);
  }

  @Get(':id')
  async getLogById(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).user?.agencyId || (req.headers['x-agency-id'] as string);
    return this.auditLogService.getLogById(tenantId, id);
  }
}
