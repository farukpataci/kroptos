import { Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { IntegrationSettingsService } from '../services/integration-settings.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';

@ApiTags('IntegrationSettings')
@Controller('/api/system/integration-settings')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class IntegrationSettingsController {
  constructor(private readonly service: IntegrationSettingsService) {}

  @Get()
  @RequirePermission('system.settings.read')
  @ApiOperation({ summary: 'Get integration settings list' })
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId);
  }

  /**
   * @deprecated Kept mounted on purpose: an existing client that still writes
   * here must get a clear 410 pointing at `/integrations`, not a 404 that reads
   * like a routing accident or a 200 that silently changes nothing.
   */
  @Put('/:provider')
  @RequirePermission('system.settings.manage')
  @ApiOperation({
    deprecated: true,
    summary: 'Removed — integrations are managed through /integrations',
  })
  @ApiResponse({ status: 410, description: 'Endpoint retired; use POST/PATCH /integrations' })
  async update() {
    return this.service.update();
  }
}
