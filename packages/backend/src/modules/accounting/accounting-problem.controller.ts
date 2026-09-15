import { Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AccountingProblemService } from './accounting-problem.service';

@ApiTags('Accounting Problems')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/accounting/problems')
export class AccountingProblemController {
  constructor(private readonly problems: AccountingProblemService) {}

  /** Tenant bağlamı yalnızca TenantMiddleware'in doğruladığı alandan (CLAUDE.md #2). */
  private agencyOf(req: Request): string {
    const r = req as any;
    return r.activeAgency?.id ?? r.user?.agencyId;
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'Problem kuyruğu (agent_offline, erp_auth_failed, invoice_stuck, …)' })
  @ApiResponse({ status: 200 })
  list(@Req() req: Request, @Query('integrationId') integrationId?: string, @Query('includeResolved') includeResolved?: string) {
    return this.problems.list(this.agencyOf(req), { integrationId, includeResolved: includeResolved === 'true' });
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Problemi çözüldü işaretle' })
  @ApiResponse({ status: 200 })
  resolve(@Req() req: Request, @Param('id') id: string) {
    const u = (req as any).user ?? {};
    return this.problems.resolve(this.agencyOf(req), id, u.email ?? u.userId ?? 'unknown');
  }
}
