import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { ApiKeysService } from '../services/api-keys.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';

@ApiTags('ApiKeys')
@Controller('/api/system/api-keys')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  @RequirePermission('system.settings.read')
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId);
  }
}
