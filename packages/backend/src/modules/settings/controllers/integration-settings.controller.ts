import { Controller, Get, Put, Req, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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

  @Put('/:provider')
  @RequirePermission('system.settings.manage')
  @ApiOperation({ summary: 'Update integration settings for a provider' })
  async update(
    @Param('provider') provider: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.update(user.agencyId, provider, data, user.userId || user.id);
  }
}
