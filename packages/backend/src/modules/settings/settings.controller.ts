import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { SettingsService } from './settings.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';

@ApiTags('System Settings')
@Controller('/api/system/settings')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermission('system.settings.read')
  @ApiOperation({ summary: 'Get global system settings' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  @RequirePermission('system.settings.manage')
  @ApiOperation({ summary: 'Update global system settings' })
  async updateSettings(@Body() data: any, @Req() req: Request) {
    const user = req.user as any;
    return this.settingsService.updateSettings(data, user.id);
  }
}
