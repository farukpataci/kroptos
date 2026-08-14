import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IntegrationQueueService } from '../integration/integration-queue.service';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
    integration: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockIntegrationQueueService = {
    addSyncJob: jest.fn().mockResolvedValue({ id: 'job-123' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationQueueService, useValue: mockIntegrationQueueService },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('should throw BadRequestException if no active store context is passed for normal user', async () => {
      await expect(
        service.list('agency-1', 'client-1', undefined, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return products belonging to storeId context', async () => {
      const row = {
        id: 'prod-1',
        name: 'Product 1',
        price: new Prisma.Decimal(1500),
        basePrice: new Prisma.Decimal(1200),
        location: {
          id: 'loc-1',
          code: 'A-01',
          barcode: 'LOC-A-01',
          warehouse: { id: 'wh-1', name: 'Ana Depo', code: 'WH1' },
          zone: { id: 'zone-1', name: 'Raf Bolgesi', code: 'Z1', type: 'shelf' },
        },
      };
      mockPrismaService.product.findMany.mockResolvedValue([row]);

      const result = await service.list('agency-1', 'client-1', 'store-1', false);

      // The point of this test: the query is scoped on all three tenant
      // levels. Asserted exactly rather than with objectContaining, because a
      // key going missing here is a cross-tenant leak, not a cosmetic change.
      const [args] = mockPrismaService.product.findMany.mock.calls[0];
      expect(args.where).toEqual({
        deletedAt: null,
        storeId: 'store-1',
        clientId: 'client-1',
        agencyId: 'agency-1',
      });
      // Soft-deleted variants must not ride along on an included relation.
      expect(args.include.variants).toEqual({ where: { deletedAt: null } });

      // Rows come back mapped, not raw: Decimal money is narrowed to a number
      // and the location is flattened. The whole include tree is deliberately
      // not pinned here — it changes for display reasons and pinning it is
      // what left this test stale through several unrelated commits.
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'prod-1',
        name: 'Product 1',
        price: 1500,
        basePrice: 1200,
        locationId: 'loc-1',
        locationCode: 'A-01',
        locationBarcode: 'LOC-A-01',
        warehouseName: 'Ana Depo',
        zoneName: 'Raf Bolgesi',
      });
    });
  });

  describe('get', () => {
    it('should throw NotFoundException if product is not found', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      await expect(
        service.get('prod-123', 'agency-1', 'client-1', 'store-1', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if product belongs to different store', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({
        id: 'prod-123',
        agencyId: 'agency-1',
        clientId: 'client-1',
        storeId: 'store-different',
      });

      await expect(
        service.get('prod-123', 'agency-1', 'client-1', 'store-1', false),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should throw BadRequestException if categoryId does not exist', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          { sku: 'SKU123', name: 'Product', price: 10, basePrice: 9, categoryId: 'cat-1' },
          'user-1',
          'agency-1',
          'client-1',
          'store-1',
          false,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if SKU already exists in store', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue({ id: 'cat-1', agencyId: 'agency-1' });
      mockPrismaService.product.findFirst.mockResolvedValue({ id: 'existing-prod' });

      await expect(
        service.create(
          { sku: 'SKU123', name: 'Product', price: 10, basePrice: 9, categoryId: 'cat-1' },
          'user-1',
          'agency-1',
          'client-1',
          'store-1',
          false,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create product successfully', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue({ id: 'cat-1', agencyId: 'agency-1' });
      mockPrismaService.product.findFirst.mockResolvedValue(null); // SKU available

      const createdProduct = {
        id: 'prod-123',
        sku: 'SKU123',
        name: 'Product',
        price: new Prisma.Decimal(10),
        basePrice: new Prisma.Decimal(9),
        storeId: 'store-1',
        clientId: 'client-1',
        agencyId: 'agency-1',
      };
      mockPrismaService.product.create.mockResolvedValue(createdProduct);

      const result = await service.create(
        { sku: 'SKU123', name: 'Product', price: 10, basePrice: 9, categoryId: 'cat-1' },
        'user-1',
        'agency-1',
        'client-1',
        'store-1',
        false,
        '127.0.0.1',
      );

      expect(result).toEqual(createdProduct);
      expect(mockPrismaService.product.create).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'create',
          entityType: 'Product',
          entityId: 'prod-123',
          userId: 'user-1',
          tenantId: 'agency-1',
        }),
      });
    });
  });

  describe('delete', () => {
    it('should successfully soft-delete and rename SKU to avoid collision', async () => {
      const mockProduct = {
        id: 'prod-123',
        sku: 'SKU123',
        agencyId: 'agency-1',
        clientId: 'client-1',
        storeId: 'store-1',
      };
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);

      await service.delete('prod-123', 'user-1', 'agency-1', 'client-1', 'store-1', false, '127.0.0.1');

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-123' },
        data: {
          sku: expect.stringContaining('SKU123_deleted_'),
          deletedAt: expect.any(Date),
          isActive: false,
          status: 'suspended',
        },
      });
    });
  });

  describe('bulkAction', () => {
    it('should throw BadRequestException if there is no active tenant context', async () => {
      await expect(
        service.bulkAction(
          { productIds: ['prod-1'], action: 'delete' },
          'user-1',
          undefined,
          undefined,
          undefined,
          false,
          '127.0.0.1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.product.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.product.updateMany).not.toHaveBeenCalled();
    });

    it('should scope the lookup to the active tenant', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU1', status: 'active', agencyId: 'agency-1', locationId: null, locationCode: null },
      ]);
      mockPrismaService.product.updateMany.mockResolvedValue({ count: 1 });

      await service.bulkAction(
        { productIds: ['prod-1'], action: 'delete' },
        'user-1',
        'agency-1',
        'client-1',
        'store-1',
        false,
        '127.0.0.1',
      );

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['prod-1'] },
            deletedAt: null,
            storeId: 'store-1',
            clientId: 'client-1',
            agencyId: 'agency-1',
          },
        }),
      );
    });

    it('should still scope by storeId when the store has no client', async () => {
      // Client'siz magazalarda TenantMiddleware activeClient'i hic kurmuyor
      // (tenant.middleware.ts:165). Bu durumda istek reddedilmemeli; storeId
      // izolasyonu tek basina sagliyor.
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU1', status: 'active', agencyId: 'agency-1', locationId: null, locationCode: null },
      ]);
      mockPrismaService.product.updateMany.mockResolvedValue({ count: 1 });

      await service.bulkAction(
        { productIds: ['prod-1'], action: 'delete' },
        'user-1',
        'agency-1',
        undefined,
        'store-1',
        false,
        '127.0.0.1',
      );

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['prod-1'] },
            deletedAt: null,
            storeId: 'store-1',
            agencyId: 'agency-1',
          },
        }),
      );
    });

    it('should throw ForbiddenException if an id is outside the active tenant', async () => {
      // 'prod-foreign' kapsamli sorgudan donmuyor: baska bir kiracinin urunu.
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU1', status: 'active', agencyId: 'agency-1', locationId: null, locationCode: null },
      ]);

      await expect(
        service.bulkAction(
          { productIds: ['prod-1', 'prod-foreign'], action: 'delete' },
          'user-1',
          'agency-1',
          'client-1',
          'store-1',
          false,
          '127.0.0.1',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.product.updateMany).not.toHaveBeenCalled();
    });

    it('should write one audit log per affected product', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'prod-1', sku: 'SKU1', status: 'active', agencyId: 'agency-1', locationId: null, locationCode: null },
        { id: 'prod-2', sku: 'SKU2', status: 'active', agencyId: 'agency-1', locationId: null, locationCode: null },
      ]);
      mockPrismaService.product.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkAction(
        { productIds: ['prod-1', 'prod-2'], action: 'update_status', data: { status: 'suspended' } },
        'user-1',
        'agency-1',
        'client-1',
        'store-1',
        false,
        '127.0.0.1',
      );

      expect(result).toEqual({ success: true, updatedCount: 2 });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'bulk_update_status',
          entityType: 'Product',
          entityId: 'prod-1',
          userId: 'user-1',
          tenantId: 'agency-1',
          ipAddress: '127.0.0.1',
        }),
      });
    });
  });
});
