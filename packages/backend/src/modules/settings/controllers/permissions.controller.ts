import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { RequirePermissionService } from '../services/permissions.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';

@ApiTags('RequirePermission')
@Controller('/api/system/permissions')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class RequirePermissionController {
  constructor(private readonly service: RequirePermissionService) {}

  @Get()
  @RequirePermission('system.settings.read')
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId);
  }
}
