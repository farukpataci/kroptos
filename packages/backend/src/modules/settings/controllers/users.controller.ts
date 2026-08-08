import { Controller, Get, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
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

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user?.role === 'super_admin' || user?.role === 'Super Admin';
  }

  @Get()
  @RequirePermission('system.settings.read')
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findAll(user.agencyId, this.checkSuperAdmin(req));
  }

  @Patch(':id/stores')
  @RequirePermission('system.settings.write')
  async updateUserStores(
    @Param('id') userId: string,
    @Body('storeIds') storeIds: string[],
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = (req.ip || req.headers['x-forwarded-for']) as string;

    return this.service.updateUserStores(
      userId,
      storeIds || [],
      activeAgency?.id,
      isSuperAdmin,
      user?.userId || user?.id,
      ipAddress,
    );
  }
}
