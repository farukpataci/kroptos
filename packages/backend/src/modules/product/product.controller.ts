import { Controller, Get, Post, Patch, Delete, Param, Body, Req, Query, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto, ProductResponseDto, BulkActionDto } from './dto/product.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';

@ApiTags('Products')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: true, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: true, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionGuard)
@Controller('/api/products')
export class ProductController {
  constructor(private productService: ProductService) {}

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user?.role === 'super_admin' || user?.role === 'Super Admin';
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('products.read')
  @ApiOperation({ summary: 'List all active products in the active store context' })
  @ApiResponse({ status: 200, type: [ProductResponseDto] })
  async list(@Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.productService.list(
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  @Get(':id')
  @HttpCode(200)
  @RequirePermission('products.read')
  @ApiOperation({ summary: 'Get active product details' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  async get(@Param('id') id: string, @Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.productService.get(
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
  @ApiOperation({ summary: 'Create a new product sales catalog item' })
  @ApiResponse({ status: 201, type: ProductResponseDto })
  async create(@Body() dto: CreateProductDto, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    return this.productService.create(
      dto,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
      ipAddress,
    );
  }

  @Patch(':id')
  @HttpCode(200)
  @RequirePermission('products.create')
  @ApiOperation({ summary: 'Update product details' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    return this.productService.update(
      id,
      dto,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
      ipAddress,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('products.create')
  @ApiOperation({ summary: 'Soft delete product' })
  @ApiResponse({ status: 204, description: 'Product soft-deleted successfully' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    await this.productService.delete(
      id,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
      ipAddress,
    );
    return;
  }

  @Post('parse-url')
  @HttpCode(200)
  @RequirePermission('products.read')
  @ApiOperation({ summary: 'Parse e-commerce product URL and extract information' })
  async parseUrl(@Body() body: { url: string }) {
    return this.productService.parseUrl(body.url);
  }

  @Get('erp-search')
  @HttpCode(200)
  @RequirePermission('products.read')
  @ApiOperation({ summary: 'Search mock ERP accounting items for mapping' })
  async searchErp(@Query('q') query?: string) {
    return this.productService.searchErpItems(query);
  }

  @Post('bulk-action')
  @HttpCode(200)
  @RequirePermission('products.create')
  @ApiOperation({ summary: 'Perform bulk operation on selected products' })
  async bulkAction(@Body() dto: BulkActionDto, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = (req.ip || req.headers['x-forwarded-for']) as string;

    return this.productService.bulkAction(
      dto,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
      ipAddress,
    );
  }
}
