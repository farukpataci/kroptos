import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { RolesService } from '../services/roles.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';

@ApiTags('Roles')
@Controller('/api/system/roles')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @RequirePermission('system.settings.read')
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId);
  }
}
