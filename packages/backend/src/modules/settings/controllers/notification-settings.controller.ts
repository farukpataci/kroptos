import { Controller, Get, Put, Req, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { NotificationSettingsService } from '../services/notification-settings.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';

@ApiTags('NotificationSettings')
@Controller('/api/system/notification-settings')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class NotificationSettingsController {
  constructor(private readonly service: NotificationSettingsService) {}

  @Get()
  @RequirePermission('system.settings.read')
  @ApiOperation({ summary: 'Get notification settings' })
  async findOne(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findOrCreate(user.agencyId);
  }

  @Put()
  @RequirePermission('system.settings.manage')
  @ApiOperation({ summary: 'Update notification settings' })
  async update(@Body() data: any, @Req() req: Request) {
    const user = req.user as any;
    return this.service.update(user.agencyId, data, user.userId || user.id);
  }
}
