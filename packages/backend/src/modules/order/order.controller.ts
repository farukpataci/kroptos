import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards, Headers, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto, OrderResponseDto } from './dto/order.dto';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID context' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID context' })
@ApiHeader({ name: 'x-store-id', required: true, description: 'Active Store ID context' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  private checkSuperAdmin(req: Request): boolean {
    const user = (req as any).user;
    return user?.role === 'super_admin' || user?.role === 'Super Admin';
  }

  @Get()
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

  @Get(':id')
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

  @Post()
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

  @Patch(':id/status')
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

  @Post(':id/cancel')
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

  @Post(':id/refund')
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
