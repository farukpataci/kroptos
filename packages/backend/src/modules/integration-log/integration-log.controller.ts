import { Controller, Get, Post, Param, Query, UseGuards, Req, Body } from '@nestjs/common';
import { IntegrationLogService } from './integration-log.service';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Controller('integration-logs')
@UseGuards(AuthGuard('jwt'))
export class IntegrationLogController {
  constructor(private readonly integrationLogService: IntegrationLogService) {}

  @Get()
  async getLogs(@Req() req: Request, @Query() query: any) {
    const tenantId = (req as any).user?.agencyId || (req.headers['x-agency-id'] as string);
    if (!tenantId) {
      return { items: [], total: 0 };
    }
    return this.integrationLogService.getLogs(tenantId, query);
  }

  @Get(':id')
  async getLogById(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).user?.agencyId || (req.headers['x-agency-id'] as string);
    return this.integrationLogService.getLogById(tenantId, id);
  }

  @Post(':id/resolve')
  async resolveLog(@Req() req: Request, @Param('id') id: string, @Body() body: { resolutionNote?: string }) {
    const tenantId = (req as any).user?.agencyId || (req.headers['x-agency-id'] as string);
    const userId = (req as any).user?.userId || (req as any).user?.id;
    return this.integrationLogService.resolveLog(tenantId, id, userId, body.resolutionNote);
  }

  @Post(':id/ignore')
  async ignoreLog(@Req() req: Request, @Param('id') id: string, @Body() body: { resolutionNote?: string }) {
    const tenantId = (req as any).user?.agencyId || (req.headers['x-agency-id'] as string);
    const userId = (req as any).user?.userId || (req as any).user?.id;
    return this.integrationLogService.ignoreLog(tenantId, id, userId, body.resolutionNote);
  }

  @Post(':id/retry')
  async retryLog(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).user?.agencyId || (req.headers['x-agency-id'] as string);
    const userId = (req as any).user?.userId || (req as any).user?.id;
    return this.integrationLogService.retryLog(tenantId, id, userId);
  }
}
