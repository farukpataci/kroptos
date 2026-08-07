import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { StoreService } from './store.service';
import { CreateStoreDto, UpdateStoreDto, StoreResponseDto } from './dto/store.dto';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Stores')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Controller('/api/stores')
export class StoreController {
  constructor(private storeService: StoreService) {}

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user?.role === 'super_admin' || user?.role === 'Super Admin';
  }

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'List all active stores authorized for the current user' })
  @ApiResponse({ status: 200, type: [StoreResponseDto] })
  async list(@Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    return this.storeService.list(user.userId, isSuperAdmin);
  }

  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get active store details' })
  @ApiResponse({ status: 200, type: StoreResponseDto })
  async get(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    return this.storeService.get(id, user.userId, isSuperAdmin);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('stores.create')
  @ApiOperation({ summary: 'Create a new store sales channel' })
  @ApiResponse({ status: 201, type: StoreResponseDto })
  async create(@Body() dto: CreateStoreDto, @Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    return this.storeService.create(dto, user.userId, isSuperAdmin, ipAddress);
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
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    return this.storeService.update(id, dto, user.userId, isSuperAdmin, ipAddress);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('stores.write')
  @ApiOperation({ summary: 'Soft delete store' })
  @ApiResponse({ status: 204, description: 'Store soft-deleted successfully' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    await this.storeService.delete(id, user.userId, isSuperAdmin, ipAddress);
    return;
  }
}
