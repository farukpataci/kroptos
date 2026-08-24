import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { Prisma } from '@prisma/client';
import { generatePublicId } from '../../common/utils/id-generator';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    action: string,
    entityId: string,
    /** Undefined for machine-made changes; the column is a nullable FK. */
    performedBy: string | undefined,
    agencyId: string,
    ipAddress?: string,
    changes: any = {},
  ) {
    try {
      await tx.auditLog.create({
        data: {
          action,
          entityType: 'Order',
          entityId,
          userId: performedBy,
          tenantId: agencyId,
          ipAddress: ipAddress || null,
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log in OrderService:', error);
    }
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${timestamp}-${random}`;
  }

  async list(
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    if (!activeStoreId && !isSuperAdmin) {
      throw new BadRequestException('Active store context is required (x-store-id header)');
    }

    const whereClause: any = { deletedAt: null };

    if (activeStoreId) {
      whereClause.storeId = activeStoreId;
    }
    if (activeClientId) {
      whereClause.clientId = activeClientId;
    }
    if (activeAgencyId) {
      whereClause.agencyId = activeAgencyId;
    }

    return this.prisma.order.findMany({
      where: whereClause,
      include: {
        items: true,
        timeline: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(
    id: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id },
          { publicId: id },
        ],
        deletedAt: null,
      },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' not found or soft-deleted`);
    }

    if (!activeStoreId && !isSuperAdmin) {
      throw new BadRequestException('Active store context is required (x-store-id header)');
    }

    if (!isSuperAdmin) {
      if (order.storeId !== activeStoreId) {
        throw new ForbiddenException('Access denied. Order belongs to a different store context.');
      }
    }

    return order;
  }

  async create(
    dto: CreateOrderDto,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    idempotencyKey?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    if (!activeStoreId && !isSuperAdmin) {
      throw new BadRequestException('Active store context is required (x-store-id header)');
    }

    const agencyId = activeAgencyId;
    const clientId = activeClientId || null;
    const storeId = activeStoreId;

    if (!agencyId || !storeId) {
      throw new BadRequestException(
        'Missing active tenant context headers (x-agency-id and x-store-id are required)',
      );
    }

    // 1. Idempotency Key check
    if (idempotencyKey) {
      const existingOrder = await this.prisma.order.findFirst({
        where: {
          storeId,
          idempotencyKey,
          deletedAt: null,
        },
        include: {
          items: true,
          timeline: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (existingOrder) {
        return existingOrder;
      }
    }

    // 2. Fetch products and calculate pricing to prevent pricing manipulation
    let calculatedTotal = new Prisma.Decimal(0);
    const orderItemsToCreate: any[] = [];

    for (const item of dto.items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, deletedAt: null },
      });

      if (!product) {
        throw new BadRequestException(`Product with ID '${item.productId}' not found or is soft-deleted`);
      }

      if (product.storeId !== storeId) {
        throw new BadRequestException(`Product '${product.name}' does not belong to active store context`);
      }

      const itemTotal = product.price.mul(item.quantity);
      calculatedTotal = calculatedTotal.add(itemTotal);

      orderItemsToCreate.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal,
      });
    }

    if (orderItemsToCreate.length === 0) {
      throw new BadRequestException('An order must contain at least one product item');
    }

    // 3. Database transaction
    return this.prisma.$transaction(async (tx) => {
      const orderNumber = this.generateOrderNumber();

      const targetStore = await tx.store.findUnique({
        where: { id: storeId },
        select: { orderProcessingMode: true },
      });
      const processingMode = targetStore?.orderProcessingMode || 'LOGO_SYNC';
      const isPool = processingMode === 'POOL_ONLY' || processingMode === 'MANUAL_APPROVAL';
      const initialLogoSyncStatus = processingMode === 'POOL_ONLY' ? 'BYPASSED_POOL' : 'PENDING';

      const order = await tx.order.create({
        data: {
          agencyId,
          clientId,
          storeId,
          channelId: dto.channelId || null,
          orderNumber,
          customerId: dto.customerId || null,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail || null,
          customerPhone: dto.customerPhone || null,
          shippingAddress: dto.shippingAddress || null,
          status: 'pending',
          paymentStatus: 'pending',
          fulfillmentStatus: 'unfulfilled',
          source: dto.source || 'manual',
          isPoolOrder: isPool,
          logoSyncStatus: initialLogoSyncStatus,
          totalAmount: calculatedTotal,
          currency: dto.currency || 'USD',
          idempotencyKey: idempotencyKey || null,
          notes: dto.notes || null,
          createdBy: userId,
          publicId: generatePublicId('ord', 12),
          items: {
            create: orderItemsToCreate.map((item) => ({
              productId: item.productId,
              sku: item.sku,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
          timeline: {
            create: {
              eventType: 'order_created',
              newValue: 'pending',
              userId,
            },
          },
        },
        include: {
          items: true,
          timeline: true,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'create',
        order.id,
        userId,
        agencyId,
        ipAddress,
        { orderNumber: order.orderNumber, totalAmount: order.totalAmount },
      );

      return order;
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    /**
     * Left undefined by the carrier tracking sweep: no person pressed anything,
     * and `AuditLog.userId` is a foreign key — a sentinel like 'system' would
     * fail it inside the transaction and take the status update down with it.
     * The timeline and audit rows then carry a null actor, which is what a
     * machine-made transition is.
     */
    userId: string | undefined,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    const order = await this.get(id, activeAgencyId, activeClientId, activeStoreId, isSuperAdmin);

    const timelineEvents: Prisma.OrderTimelineCreateWithoutOrderInput[] = [];
    const updates: Prisma.OrderUpdateInput = {};

    if (dto.status !== undefined && dto.status !== order.status) {
      updates.status = dto.status;
      timelineEvents.push({
        eventType: 'status_changed',
        oldValue: order.status,
        newValue: dto.status,
        userId,
      });
    }

    if (dto.paymentStatus !== undefined && dto.paymentStatus !== order.paymentStatus) {
      updates.paymentStatus = dto.paymentStatus;
      timelineEvents.push({
        eventType: 'payment_status_changed',
        oldValue: order.paymentStatus,
        newValue: dto.paymentStatus,
        userId,
      });
    }

    if (dto.fulfillmentStatus !== undefined && dto.fulfillmentStatus !== order.fulfillmentStatus) {
      updates.fulfillmentStatus = dto.fulfillmentStatus;
      timelineEvents.push({
        eventType: 'fulfillment_status_changed',
        oldValue: order.fulfillmentStatus,
        newValue: dto.fulfillmentStatus,
        userId,
      });
    }

    if (dto.notes !== undefined) {
      updates.notes = dto.notes;
    }

    if (Object.keys(updates).length === 0) {
      return order; // No fields changed
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          ...updates,
          timeline: {
            create: timelineEvents,
          },
        },
        include: {
          items: true,
          timeline: { orderBy: { createdAt: 'desc' } },
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'update_status',
        id,
        userId,
        order.agencyId,
        ipAddress,
        {
          before: { status: order.status, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus },
          after: { status: updatedOrder.status, paymentStatus: updatedOrder.paymentStatus, fulfillmentStatus: updatedOrder.fulfillmentStatus },
        },
      );

      return updatedOrder;
    });
  }

  async cancel(
    id: string,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    const order = await this.get(id, activeAgencyId, activeClientId, activeStoreId, isSuperAdmin);

    if (order.status === 'cancelled') {
      throw new BadRequestException('Order is already cancelled');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'cancelled',
          fulfillmentStatus: 'returned',
          timeline: {
            create: {
              eventType: 'order_cancelled',
              oldValue: order.status,
              newValue: 'cancelled',
              userId,
            },
          },
        },
        include: {
          items: true,
          timeline: { orderBy: { createdAt: 'desc' } },
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'cancel',
        id,
        userId,
        order.agencyId,
        ipAddress,
        { oldValue: order.status, newValue: 'cancelled' },
      );

      return updatedOrder;
    });
  }

  async refund(
    id: string,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    const order = await this.get(id, activeAgencyId, activeClientId, activeStoreId, isSuperAdmin);

    if (order.paymentStatus === 'refunded') {
      throw new BadRequestException('Order payment is already refunded');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          paymentStatus: 'refunded',
          timeline: {
            create: {
              eventType: 'order_refunded',
              oldValue: order.paymentStatus,
              newValue: 'refunded',
              userId,
            },
          },
        },
        include: {
          items: true,
          timeline: { orderBy: { createdAt: 'desc' } },
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'refund',
        id,
        userId,
        order.agencyId,
        ipAddress,
        { oldValue: order.paymentStatus, newValue: 'refunded' },
      );

      return updatedOrder;
    });
  }
}
