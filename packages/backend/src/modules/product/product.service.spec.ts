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
      const mockProducts = [{ id: 'prod-1', name: 'Product 1' }];
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);

      const result = await service.list('agency-1', 'client-1', 'store-1', false);

      expect(result).toEqual(mockProducts);
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          storeId: 'store-1',
          clientId: 'client-1',
          agencyId: 'agency-1',
        },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          bundleItems: {
            include: {
              childProduct: {
                select: { id: true, publicId: true, name: true, sku: true, price: true }
              }
            }
          },
          crossSellSources: {
            include: {
              targetProduct: {
                select: { id: true, publicId: true, name: true, sku: true, price: true }
              }
            }
          },
          variants: {
            where: { deletedAt: null }
          }
        },
        orderBy: { createdAt: 'desc' },
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
});
