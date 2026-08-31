import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('OrderService', () => {
  let service: OrderService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    order: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    // `create` reads the store's processing mode inside the transaction to
    // decide whether the order goes to the pool. LOGO_SYNC is the mode the
    // assertions below describe: not a pool order, sync pending.
    store: {
      findUnique: jest.fn().mockResolvedValue({ orderProcessingMode: 'LOGO_SYNC' }),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('should throw BadRequestException if store context is missing and not super admin', async () => {
      await expect(
        service.list('agency-1', 'client-1', undefined, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return list of orders belonging to store', async () => {
      const mockOrders = [{ id: 'order-1', orderNumber: 'ORD-123' }];
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.list('agency-1', 'client-1', 'store-1', false);

      expect(result).toEqual(mockOrders);
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          storeId: 'store-1',
          clientId: 'client-1',
          agencyId: 'agency-1',
        },
        include: {
          items: true,
          timeline: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('get', () => {
    it('should throw NotFoundException if order does not exist', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.get('order-id', 'agency-1', 'client-1', 'store-1', false),
      ).rejects.toThrow(NotFoundException);
    });

    /**
     * Replaces a test that mocked findFirst into returning a foreign-store row
     * and expected a ForbiddenException. That row can no longer exist: the
     * scope is in the where clause, so the database never hands it back, and a
     * mock that produces one is asserting against a state the code has stopped
     * being able to reach.
     *
     * What a mock can still pin is the shape of the query — specifically that
     * the scope sits OUTSIDE the OR. Folded in as `OR: [{ id, agencyId }, ...]`
     * the publicId branch would be unscoped, which reads as a working fix and
     * leaks rows. That the scoping actually keeps tenants apart is proven in
     * order.tenant-scope.integration-spec.ts, against a real database with two
     * real tenants; CLAUDE.md §7 is explicit that this assertion here is not
     * that proof.
     */
    it('puts the tenant scope in the where clause, outside the OR', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({ id: 'order-1' });

      await service.get('order-1', 'agency-1', 'client-1', 'store-1', false);

      const { where } = mockPrismaService.order.findFirst.mock.calls.at(-1)[0];
      expect(where).toMatchObject({
        agencyId: 'agency-1',
        clientId: 'client-1',
        storeId: 'store-1',
        deletedAt: null,
      });
      // The lookup keys carry no scope of their own — it applies to both.
      expect(where.OR).toEqual([{ id: 'order-1' }, { publicId: 'order-1' }]);
    });

    it('leaves the query unscoped for a super admin', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({ id: 'order-1' });

      await service.get('order-1', 'agency-1', 'client-1', 'store-1', true);

      const { where } = mockPrismaService.order.findFirst.mock.calls.at(-1)[0];
      expect(where.agencyId).toBeUndefined();
      expect(where.storeId).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should implement idempotency and return existing order if key matches', async () => {
      const existingOrder = { id: 'order-1', idempotencyKey: 'idempotent-key' };
      mockPrismaService.order.findFirst.mockResolvedValue(existingOrder);

      const result = await service.create(
        { customerName: 'John', items: [] },
        'user-1',
        'agency-1',
        'client-1',
        'store-1',
        'idempotent-key',
        false,
      );

      expect(result).toEqual(existingOrder);
      expect(mockPrismaService.order.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if product is missing or does not match store context', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null); // No idempotent duplicate
      mockPrismaService.product.findFirst.mockResolvedValue(null); // Product doesn't exist

      await expect(
        service.create(
          { customerName: 'John', items: [{ productId: 'prod-1', quantity: 2 }] },
          'user-1',
          'agency-1',
          'client-1',
          'store-1',
          undefined,
          false,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create order calculating correct totals and inserting timeline and audit logs', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);
      mockPrismaService.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Laptop',
        sku: 'LAP-1',
        price: new Prisma.Decimal(1000),
        storeId: 'store-1',
      });

      const createdOrder = {
        id: 'order-123',
        orderNumber: 'ORD-123',
        totalAmount: new Prisma.Decimal(2000),
      };
      mockPrismaService.order.create.mockResolvedValue(createdOrder);

      const result = await service.create(
        { customerName: 'John', items: [{ productId: 'prod-1', quantity: 2 }] },
        'user-1',
        'agency-1',
        'client-1',
        'store-1',
        undefined,
        false,
        '127.0.0.1',
      );

      expect(result).toEqual(createdOrder);
      expect(mockPrismaService.order.create).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'create',
          entityType: 'Order',
          entityId: 'order-123',
          userId: 'user-1',
        }),
      });
    });
  });

  describe('updateStatus', () => {
    it('should record timeline events when updating order workflow state fields', async () => {
      const existingOrder = {
        id: 'order-123',
        status: 'pending',
        paymentStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        agencyId: 'agency-1',
        clientId: 'client-1',
        storeId: 'store-1',
      };
      mockPrismaService.order.findFirst.mockResolvedValue(existingOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...existingOrder,
        status: 'processing',
      });

      await service.updateStatus(
        'order-123',
        { status: 'processing' },
        'user-1',
        'agency-1',
        'client-1',
        'store-1',
        false,
        '127.0.0.1',
      );

      expect(mockPrismaService.order.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'order-123' },
        data: expect.objectContaining({
          status: 'processing',
          timeline: {
            create: [
              {
                eventType: 'status_changed',
                oldValue: 'pending',
                newValue: 'processing',
                userId: 'user-1',
              },
            ],
          },
        }),
      }));
    });
  });

  describe('cancel', () => {
    it('should throw BadRequestException if order is already cancelled', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: 'order-123',
        status: 'cancelled',
        agencyId: 'agency-1',
        clientId: 'client-1',
        storeId: 'store-1',
      });

      await expect(
        service.cancel('order-123', 'user-1', 'agency-1', 'client-1', 'store-1', false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transition order to cancelled state and log timelines', async () => {
      const mockOrder = {
        id: 'order-123',
        status: 'pending',
        agencyId: 'agency-1',
        clientId: 'client-1',
        storeId: 'store-1',
      };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: 'cancelled',
      });

      await service.cancel('order-123', 'user-1', 'agency-1', 'client-1', 'store-1', false, '127.0.0.1');

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: {
          status: 'cancelled',
          fulfillmentStatus: 'returned',
          timeline: {
            create: {
              eventType: 'order_cancelled',
              oldValue: 'pending',
              newValue: 'cancelled',
              userId: 'user-1',
            },
          },
        },
        include: {
          items: true,
          timeline: { orderBy: { createdAt: 'desc' } },
        },
      });
    });
  });

  describe('refund', () => {
    it('should transition paymentStatus to refunded and write timeline logs', async () => {
      const mockOrder = {
        id: 'order-123',
        paymentStatus: 'paid',
        agencyId: 'agency-1',
        clientId: 'client-1',
        storeId: 'store-1',
      };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'refunded',
      });

      await service.refund('order-123', 'user-1', 'agency-1', 'client-1', 'store-1', false, '127.0.0.1');

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: {
          paymentStatus: 'refunded',
          timeline: {
            create: {
              eventType: 'order_refunded',
              oldValue: 'paid',
              newValue: 'refunded',
              userId: 'user-1',
            },
          },
        },
        include: {
          items: true,
          timeline: { orderBy: { createdAt: 'desc' } },
        },
      });
    });
  });
});
