import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from './category.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CategoryService', () => {
  let service: CategoryService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    product: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('should return categories under store/client/agency context', async () => {
      const mockCategories = [{ id: 'cat-1', name: 'Electronics' }];
      mockPrismaService.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.list('agency-1', 'client-1', 'store-1');

      expect(result).toEqual(mockCategories);
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: [
            { storeId: 'store-1' },
            { storeId: null, clientId: 'client-1', agencyId: 'agency-1' },
            { storeId: null, clientId: null, agencyId: 'agency-1' },
          ],
        },
        include: {
          parent: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { displayOrder: 'asc' },
      });
    });
  });

  describe('get', () => {
    it('should throw NotFoundException if category does not exist', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(null);

      await expect(service.get('invalid-id', 'agency-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if category agency context mismatch', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue({ id: 'cat-1', agencyId: 'agency-different' });

      await expect(service.get('cat-1', 'agency-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should throw BadRequestException if parent category does not exist', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(null); // Parent doesn't exist

      await expect(
        service.create(
          { agencyId: 'agency-1', parentId: 'parent-1', name: 'Subcat' },
          'user-1',
          'agency-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if slug already exists', async () => {
      mockPrismaService.category.findFirst
        .mockResolvedValueOnce({ id: 'parent-1', agencyId: 'agency-1' }) // Parent check
        .mockResolvedValueOnce({ id: 'existing-cat', slug: 'subcat' }); // Slug collision check

      await expect(
        service.create(
          { agencyId: 'agency-1', parentId: 'parent-1', name: 'Subcat', slug: 'subcat' },
          'user-1',
          'agency-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create category', async () => {
      mockPrismaService.category.findFirst
        .mockResolvedValueOnce({ id: 'parent-1', agencyId: 'agency-1' }) // Parent check
        .mockResolvedValueOnce(null); // No slug collision

      const createdCat = { id: 'cat-123', agencyId: 'agency-1', name: 'Subcat', slug: 'subcat', parentId: 'parent-1' };
      mockPrismaService.category.create.mockResolvedValue(createdCat);

      const result = await service.create(
        { agencyId: 'agency-1', parentId: 'parent-1', name: 'Subcat', slug: 'subcat' },
        'user-1',
        'agency-1',
        'client-1',
        'store-1',
        '127.0.0.1',
      );

      expect(result).toEqual(createdCat);
      expect(mockPrismaService.category.create).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'create',
          entityType: 'Category',
          entityId: 'cat-123',
          userId: 'user-1',
          tenantId: 'agency-1',
          ipAddress: '127.0.0.1',
        }),
      });
    });
  });

  describe('update', () => {
    it('should throw BadRequestException if parent cycle detected', async () => {
      const mockCategory = { id: 'cat-123', agencyId: 'agency-1', name: 'Cat Name', slug: 'cat-slug' };
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory); // Self query and parent query
      mockPrismaService.category.findUnique.mockResolvedValue({ parentId: 'cat-123' }); // Parent hierarchy simulation

      await expect(
        service.update('cat-123', { parentId: 'parent-1' }, 'user-1', 'agency-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should successfully soft delete category and clean parent references', async () => {
      const mockCategory = { id: 'cat-123', agencyId: 'agency-1', name: 'Cat to Delete', slug: 'cat-slug' };
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);

      await service.delete('cat-123', 'user-1', 'agency-1', 'client-1', 'store-1', '127.0.0.1');

      expect(mockPrismaService.category.updateMany).toHaveBeenCalledWith({
        where: { parentId: 'cat-123', deletedAt: null },
        data: { parentId: null },
      });
      expect(mockPrismaService.product.updateMany).toHaveBeenCalledWith({
        where: { categoryId: 'cat-123', deletedAt: null },
        data: { categoryId: null },
      });
      expect(mockPrismaService.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-123' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
        },
      });
    });
  });
});
