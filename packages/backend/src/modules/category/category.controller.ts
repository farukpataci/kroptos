import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto/category.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Categories')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: false, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/categories')
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user?.role === 'super_admin' || user?.role === 'Super Admin';
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('products.read')
  @ApiOperation({ summary: 'List all categories in the active tenant context' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  async list(@Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.categoryService.list(
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('products.read')
  @ApiOperation({ summary: 'Get category details' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  async get(@Param('id') id: string, @Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.categoryService.get(
      id,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('products.create')
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  async create(@Body() dto: CreateCategoryDto, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    return this.categoryService.create(
      dto,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      ipAddress,
    );
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('products.create')
  @ApiOperation({ summary: 'Update category details' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    return this.categoryService.update(
      id,
      dto,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      ipAddress,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('products.create')
  @ApiOperation({ summary: 'Soft delete category' })
  @ApiResponse({ status: 204, description: 'Category soft-deleted successfully' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    await this.categoryService.delete(
      id,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      ipAddress,
    );
    return;
  }
}
