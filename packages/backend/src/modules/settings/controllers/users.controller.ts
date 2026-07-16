import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { UsersService } from '../services/users.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';

@ApiTags('Users')
@Controller('/api/system/users')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermission('system.settings.read')
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId);
  }
}
