import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards, Headers, HttpCode, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto, OrderResponseDto } from './dto/order.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantGuard } from '../../common/guards/tenant.guard';

@ApiTags('Orders')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: true, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionGuard)
@Controller()
export class OrderController {
  constructor(
    private orderService: OrderService,
    private prisma: PrismaService,
  ) {}

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user?.role === 'super_admin' || user?.role === 'Super Admin';
  }

  @Get('/api/orders')
  @HttpCode(200)
  @RequirePermission('orders.read')
  @ApiOperation({ summary: 'List all active orders in the active tenant context' })
  @ApiResponse({ status: 200, type: [OrderResponseDto] })
  async list(@Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.orderService.list(
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  @Get('/api/orders/:id')
  @HttpCode(200)
  @RequirePermission('orders.read')
  @ApiOperation({ summary: 'Get active order details' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  async get(@Param('id') id: string, @Req() req: Request) {
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);

    return this.orderService.get(
      id,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
    );
  }

  @Get('/api/tenants/:tenantPublicId/orders')
  @HttpCode(200)
  @RequirePermission('orders.read')
  @ApiOperation({ summary: 'List all orders for a specific tenant public ID' })
  @ApiResponse({ status: 200, type: [OrderResponseDto] })
  async listByTenant(@Param('tenantPublicId') tenantPublicId: string, @Req() req: Request) {
    const isSuperAdmin = this.checkSuperAdmin(req);
    const agency = await this.prisma.agency.findUnique({
      where: { publicId: tenantPublicId }
    });
    if (!agency) {
      throw new NotFoundException('Tenant not found');
    }

    if (!isSuperAdmin) {
      const user = (req as any).user;
      const userRole = await this.prisma.userRole.findFirst({
        where: {
          userId: user.userId,
          agencyId: agency.id,
          deletedAt: null,
        }
      });
      if (!userRole) {
        throw new ForbiddenException('Access denied to this tenant');
      }
    }

    return this.orderService.list(
      agency.id,
      undefined,
      undefined,
      isSuperAdmin,
    );
  }

  @Post('/api/orders')
  @HttpCode(201)
  @RequirePermission('orders.update')
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: 'Optional unique idempotency key header context' })
  @ApiOperation({ summary: 'Create a new client order' })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  async create(
    @Body() dto: CreateOrderDto,
    @Req() req: Request,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    return this.orderService.create(
      dto,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      idempotencyKey,
      isSuperAdmin,
      ipAddress,
    );
  }

  @Patch('/api/orders/:id/status')
  @HttpCode(200)
  @RequirePermission('orders.update')
  @ApiOperation({ summary: 'Update order lifecycle workflow state values' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    return this.orderService.updateStatus(
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

  @Post('/api/orders/:id/cancel')
  @HttpCode(200)
  @RequirePermission('orders.update')
  @ApiOperation({ summary: 'Cancel order processing' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  async cancel(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    return this.orderService.cancel(
      id,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
      ipAddress,
    );
  }

  @Post('/api/orders/:id/refund')
  @HttpCode(200)
  @RequirePermission('orders.update')
  @ApiOperation({ summary: 'Refund order payments' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  async refund(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;
    const isSuperAdmin = this.checkSuperAdmin(req);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    return this.orderService.refund(
      id,
      user.userId,
      activeAgency?.id,
      activeClient?.id,
      activeStore?.id,
      isSuperAdmin,
      ipAddress,
    );
  }
}
