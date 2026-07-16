import { Controller, Get, Put, Req, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { TenantSettingsService } from '../services/tenant-settings.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';

@ApiTags('TenantSettings')
@Controller('/api/system/tenant-settings')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class TenantSettingsController {
  constructor(private readonly service: TenantSettingsService) {}

  @Get()
  @RequirePermission('system.settings.read')
  @ApiOperation({ summary: 'Get tenant settings' })
  async findOne(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findOrCreate(user.agencyId);
  }

  @Put()
  @RequirePermission('system.settings.manage')
  @ApiOperation({ summary: 'Update tenant settings' })
  async update(@Body() data: any, @Req() req: Request) {
    const user = req.user as any;
    return this.service.update(user.agencyId, data, user.userId || user.id);
  }
}
