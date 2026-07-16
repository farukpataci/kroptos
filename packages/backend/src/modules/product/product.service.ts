import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { Prisma } from '@prisma/client';
import { IntegrationQueueService } from '../integration/integration-queue.service';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private integrationQueueService: IntegrationQueueService,
  ) {}

  private async writeAuditLog(
    tx: any,
    action: string,
    entityId: string,
    performedBy: string,
    agencyId: string,
    ipAddress?: string,
    changes: any = {},
  ) {
    try {
      await tx.auditLog.create({
        data: {
          action,
          entityType: 'Product',
          entityId,
          performedBy,
          agencyId,
          ipAddress: ipAddress || null,
          changes: JSON.stringify(changes),
        },
      });
    } catch (error) {
      console.error('Failed to write audit log in ProductService:', error);
    }
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

    return this.prisma.product.findMany({
      where: whereClause,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
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
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${id}' not found or soft-deleted`);
    }

    if (!isSuperAdmin) {
      if (activeStoreId && product.storeId !== activeStoreId) {
        throw new ForbiddenException('Access denied. Product belongs to a different store context.');
      }
      if (activeClientId && product.clientId !== activeClientId) {
        throw new ForbiddenException('Access denied. Product belongs to a different client context.');
      }
      if (activeAgencyId && product.agencyId !== activeAgencyId) {
        throw new ForbiddenException('Access denied. Product belongs to a different agency context.');
      }
    }

    return product;
  }

  async create(
    dto: CreateProductDto,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    if (!activeStoreId && !isSuperAdmin) {
      throw new BadRequestException('Active store context is required (x-store-id header)');
    }

    // Determine the context fields. Use values from active context
    const agencyId = activeAgencyId;
    const clientId = activeClientId;
    const storeId = activeStoreId;

    if (!agencyId || !clientId || !storeId) {
      throw new BadRequestException(
        'Missing active tenant context headers (x-agency-id, x-client-id, and x-store-id are required)',
      );
    }

    // Validate categoryId if provided
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, deletedAt: null },
      });
      if (!category) {
        throw new BadRequestException(`Category '${dto.categoryId}' does not exist or is soft-deleted`);
      }
      // Ensure category belongs to the same agency
      if (category.agencyId !== agencyId) {
        throw new BadRequestException('Category belongs to a different agency context');
      }
    }

    // Verify SKU uniqueness inside the store
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        storeId,
        sku: dto.sku,
        deletedAt: null,
      },
    });

    if (existingProduct) {
      throw new BadRequestException(`Product with SKU '${dto.sku}' already exists in this store`);
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          agencyId,
          clientId,
          storeId,
          categoryId: dto.categoryId || null,
          sku: dto.sku,
          name: dto.name,
          description: dto.description || null,
          price: new Prisma.Decimal(dto.price),
          basePrice: new Prisma.Decimal(dto.basePrice),
          costPrice: dto.costPrice !== undefined ? new Prisma.Decimal(dto.costPrice) : null,
          barcode: dto.barcode || null,
          currency: dto.currency || 'USD',
          stockQuantity: dto.stockQuantity !== undefined ? dto.stockQuantity : 0,
          status: dto.status || 'active',
          weight: dto.weight !== undefined ? new Prisma.Decimal(dto.weight) : null,
          width: dto.width !== undefined ? new Prisma.Decimal(dto.width) : null,
          height: dto.height !== undefined ? new Prisma.Decimal(dto.height) : null,
          depth: dto.depth !== undefined ? new Prisma.Decimal(dto.depth) : null,
          image: dto.image || null,
          isActive: true,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'create',
        product.id,
        userId,
        agencyId,
        ipAddress,
        { sku: product.sku, name: product.name, price: product.price },
      );

      return product;
    });
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    const product = await this.get(id, activeAgencyId, activeClientId, activeStoreId, isSuperAdmin);

    // Validate categoryId if provided
    if (dto.categoryId !== undefined) {
      if (dto.categoryId === null) {
        // Clearing category
      } else {
        const category = await this.prisma.category.findFirst({
          where: { id: dto.categoryId, deletedAt: null },
        });
        if (!category) {
          throw new BadRequestException(`Category '${dto.categoryId}' does not exist or is soft-deleted`);
        }
        if (category.agencyId !== product.agencyId) {
          throw new BadRequestException('Category belongs to a different agency context');
        }
      }
    }

    // Verify SKU uniqueness inside the store if SKU is being changed
    if (dto.sku !== undefined && dto.sku !== product.sku) {
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          storeId: product.storeId,
          sku: dto.sku,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existingProduct) {
        throw new BadRequestException(`Product with SKU '${dto.sku}' already exists in this store`);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          categoryId: dto.categoryId !== undefined ? dto.categoryId : undefined,
          sku: dto.sku || undefined,
          name: dto.name || undefined,
          description: dto.description !== undefined ? dto.description : undefined,
          price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
          basePrice: dto.basePrice !== undefined ? new Prisma.Decimal(dto.basePrice) : undefined,
          costPrice: dto.costPrice !== undefined ? new Prisma.Decimal(dto.costPrice) : undefined,
          barcode: dto.barcode !== undefined ? dto.barcode : undefined,
          currency: dto.currency || undefined,
          stockQuantity: dto.stockQuantity !== undefined ? dto.stockQuantity : undefined,
          status: dto.status || undefined,
          weight: dto.weight !== undefined ? new Prisma.Decimal(dto.weight) : undefined,
          width: dto.width !== undefined ? new Prisma.Decimal(dto.width) : undefined,
          height: dto.height !== undefined ? new Prisma.Decimal(dto.height) : undefined,
          depth: dto.depth !== undefined ? new Prisma.Decimal(dto.depth) : undefined,
          image: dto.image !== undefined ? dto.image : undefined,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'update',
        id,
        userId,
        product.agencyId,
        ipAddress,
        {
          before: { sku: product.sku, name: product.name, price: product.price, status: product.status },
          after: { sku: updatedProduct.sku, name: updatedProduct.name, price: updatedProduct.price, status: updatedProduct.status },
        },
      );

      return updatedProduct;
    });

    // Enqueue stock sync job for active integrations
    if (dto.stockQuantity !== undefined && dto.stockQuantity !== product.stockQuantity) {
      try {
        const activeIntegrations = await this.prisma.integration.findMany({
          where: {
            providerType: 'marketplace',
            status: 'active',
            deletedAt: null,
            OR: [
              { storeId: product.storeId },
              { storeId: null, clientId: product.clientId, agencyId: product.agencyId },
              { storeId: null, clientId: null, agencyId: product.agencyId },
            ],
          },
        });

        for (const integration of activeIntegrations) {
          await this.integrationQueueService.addSyncJob(
            integration.id,
            'sync_stock',
            { sku: result.sku, quantity: result.stockQuantity },
          );
        }
      } catch (err) {
        console.error('Failed to enqueue stock sync jobs:', err);
      }
    }

    return result;
  }

  async delete(
    id: string,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    isSuperAdmin?: boolean,
    ipAddress?: string,
  ) {
    const product = await this.get(id, activeAgencyId, activeClientId, activeStoreId, isSuperAdmin);

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // Free up SKU constraint by appending deleted timestamp to SKU
      const deletedSku = `${product.sku}_deleted_${Date.now()}`;

      await tx.product.update({
        where: { id },
        data: {
          sku: deletedSku,
          deletedAt: now,
          isActive: false,
          status: 'suspended',
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'delete',
        id,
        userId,
        product.agencyId,
        ipAddress,
        { sku: product.sku, deletedAt: now },
      );
    });
  }
}
