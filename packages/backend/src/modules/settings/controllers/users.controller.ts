import { Controller, Get, Patch, Delete, Param, Body, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { UsersService } from '../services/users.service';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';
import { actorFromRequest } from '../../rbac/rbac.service';
import { ChangeUserRoleDto, ListUsersQueryDto, UpdateUserDto } from '../dto/users.dto';

/**
 * Kullanici yonetimi, AKTIF ajans kapsaminda. Baglam TenantMiddleware'in yazdigi
 * req.activeAgency'den (actorFromRequest); DTO'dan ajans alinmaz.
 * Kullanici olusturma YOK: kullanici yalniz davetle gelir (P6).
 */
@ApiTags('Users')
@Controller('/api/system/users')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermission('users.view')
  @ApiOperation({ summary: 'Aktif ajansin kullanicilari (arama, rol, durum, sayfalama)' })
  async findAll(@Query() query: ListUsersQueryDto, @Req() req: Request) {
    return this.service.findAll(query, actorFromRequest(req));
  }

  @Get(':id')
  @RequirePermission('users.view')
  @ApiOperation({ summary: 'Kullanici detayi + bu ajanstaki tum erisim kapsamlari' })
  async findOne(@Param('id') userId: string, @Req() req: Request) {
    return this.service.findOne(userId, actorFromRequest(req));
  }

  @Patch(':id')
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'isActive, firstName, lastName, phone' })
  async update(@Param('id') userId: string, @Body() dto: UpdateUserDto, @Req() req: Request) {
    return this.service.update(userId, dto, actorFromRequest(req));
  }

  @Patch(':id/role')
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Bu ajanstaki rolu degistir (roleId + kapsam)' })
  async changeRole(@Param('id') userId: string, @Body() dto: ChangeUserRoleDto, @Req() req: Request) {
    return this.service.changeRole(userId, dto, actorFromRequest(req));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('users.manage')
  @ApiOperation({ summary: "Tenant'tan cikar (User silinmez; bu ajanstaki UserRole/StoreUser kapanir)" })
  async remove(@Param('id') userId: string, @Req() req: Request) {
    await this.service.removeFromTenant(userId, actorFromRequest(req));
  }

  @Patch(':id/stores')
  @RequirePermission('system.settings.write')
  async updateUserStores(
    @Param('id') userId: string,
    @Body('storeIds') storeIds: string[],
    @Req() req: Request,
  ) {
    return this.service.updateUserStores(userId, storeIds || [], actorFromRequest(req));
  }
}
