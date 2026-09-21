import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { StoreService } from './store.service';
import { CreateStoreDto, UpdateStoreDto, StoreResponseDto } from './dto/store.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { isSuperAdminRole } from '../../common/constants/platform-admin';
import { actorFromRequest } from '../rbac/rbac.service';

@ApiTags('Stores')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/stores')
export class StoreController {
  constructor(private storeService: StoreService) {}

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return isSuperAdminRole(user);
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('stores.read')
  @ApiOperation({ summary: 'List all active stores authorized for the current user' })
  @ApiResponse({ status: 200, type: [StoreResponseDto] })
  async list(@Req() req: Request) {
    return this.storeService.list(actorFromRequest(req), this.checkSuperAdmin(req));
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('stores.read')
  @ApiOperation({ summary: 'Get active store details' })
  @ApiResponse({ status: 200, type: StoreResponseDto })
  async get(@Param('id') id: string, @Req() req: Request) {
    return this.storeService.get(id, actorFromRequest(req), this.checkSuperAdmin(req));
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('stores.create')
  @ApiOperation({ summary: 'Create a new store sales channel' })
  @ApiResponse({ status: 201, type: StoreResponseDto })
  async create(@Body() dto: CreateStoreDto, @Req() req: Request) {
    return this.storeService.create(dto, actorFromRequest(req));
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('stores.write')
  @ApiOperation({ summary: 'Update store details' })
  @ApiResponse({ status: 200, type: StoreResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
    @Req() req: Request,
  ) {
    return this.storeService.update(id, dto, actorFromRequest(req), this.checkSuperAdmin(req));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('stores.write')
  @ApiOperation({ summary: 'Soft delete store' })
  @ApiResponse({ status: 204, description: 'Store soft-deleted successfully' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.storeService.delete(id, actorFromRequest(req), this.checkSuperAdmin(req));
    return;
  }
}
