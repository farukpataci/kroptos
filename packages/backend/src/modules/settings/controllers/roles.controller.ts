import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PERMISSIONS, PERMISSION_CATEGORIES } from '@kroptos/shared';
import { PermissionGuard } from '@common/guards/permission.guard';
import { RequirePermission } from '@common/decorators/require-permission.decorator';
import { actorFromRequest } from '../../rbac/rbac.service';
import { RolesService } from '../services/roles.service';
import { CreateRoleDto, UpdateRoleDto } from '../dto/roles.dto';

/** Rol yonetimi: sistem rolleri salt-okunur, ozel roller aktif ajansa ait. */
@ApiTags('Roles')
@Controller('/api/system/roles')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @RequirePermission('roles.view')
  @ApiOperation({ summary: 'Sistem rolleri + bu ajansin ozel rolleri (userCount, permissions[])' })
  list(@Req() req: Request) {
    return this.service.list(actorFromRequest(req));
  }

  @Get(':id')
  @RequirePermission('roles.view')
  get(@Param('id') id: string, @Req() req: Request) {
    return this.service.get(id, actorFromRequest(req));
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('roles.manage')
  @ApiOperation({ summary: 'Ozel rol olustur (agencyId = aktif ajans; sistem key leri rezerve)' })
  create(@Body() dto: CreateRoleDto, @Req() req: Request) {
    return this.service.create(dto, actorFromRequest(req));
  }

  @Patch(':id')
  @RequirePermission('roles.manage')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @Req() req: Request) {
    return this.service.update(id, dto, actorFromRequest(req));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('roles.manage')
  async remove(@Param('id') id: string, @Req() req: Request) {
    await this.service.remove(id, actorFromRequest(req));
  }
}

/** Izin katalogu: global, @kroptos/shared'dan; tenant'a bagli degil. */
@ApiTags('Roles')
@Controller('/api/system/permissions')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@ApiBearerAuth()
export class PermissionsController {
  @Get()
  @RequirePermission('roles.view')
  @ApiOperation({ summary: 'Izin katalogu, kategori gruplu' })
  list() {
    return PERMISSION_CATEGORIES.map((category) => ({
      category,
      // '*:*' katalogda ama tenant roluna verilemez; UI matrisinde gosterilmez.
      permissions: PERMISSIONS.filter((p) => p.category === category && p.key !== '*:*').map((p) => ({
        key: p.key,
        name: p.name,
        description: p.description,
        unusedYet: p.unusedYet ?? false,
      })),
    })).filter((g) => g.permissions.length > 0);
  }
}
