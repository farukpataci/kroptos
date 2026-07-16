import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AdjustInventoryDto, AdjustmentType } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // Automatically ensure all products in the active store have an inventory record
  private async ensureInventoriesExist(agencyId: string, storeId: string) {
    const products = await this.prisma.product.findMany({
      where: { storeId, deletedAt: null },
    });

    for (const prod of products) {
      await this.prisma.inventory.upsert({
        where: {
          storeId_productId: {
            storeId,
            productId: prod.id,
          },
        },
        update: {},
        create: {
          agencyId,
          storeId,
          productId: prod.id,
          availableQty: prod.stockQuantity || 0,
          reservedQty: 0,
          defectiveQty: 0,
          reorderLevel: 10,
        },
      });
    }
  }

  async list(agencyId: string, storeId: string) {
    if (!storeId) {
      throw new BadRequestException('Store context is required');
    }

    // Auto-create missing inventory records to self-heal
    await this.ensureInventoriesExist(agencyId, storeId);

    return this.prisma.inventory.findMany({
      where: { storeId },
      include: {
        product: {
          include: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async adjust(dto: AdjustInventoryDto, userId: string, agencyId: string, storeId: string) {
    if (!storeId) {
      throw new BadRequestException('Store context is required');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, storeId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${dto.productId}' not found in this store context`);
    }

    // Get or create inventory
    const inventory = await this.prisma.inventory.upsert({
      where: {
        storeId_productId: {
          storeId,
          productId: product.id,
        },
      },
      update: {},
      create: {
        agencyId,
        storeId,
        productId: product.id,
        availableQty: product.stockQuantity || 0,
        reservedQty: 0,
        defectiveQty: 0,
        reorderLevel: 10,
      },
    });

    const beforeQty = inventory.availableQty;
    let afterQty = beforeQty;
    let diff = dto.quantity;

    if (dto.type === AdjustmentType.INBOUND) {
      afterQty += diff;
    } else if (
      dto.type === AdjustmentType.OUTBOUND ||
      dto.type === AdjustmentType.DAMAGE ||
      dto.type === AdjustmentType.LOST
    ) {
      afterQty = Math.max(0, beforeQty - diff);
      diff = -diff;
    } else if (dto.type === AdjustmentType.COUNT) {
      // For manual count, quantity parameter is the final counted total
      afterQty = dto.quantity;
      diff = afterQty - beforeQty;
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Inventory Table
      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          availableQty: afterQty,
          defectiveQty: dto.type === AdjustmentType.DAMAGE ? inventory.defectiveQty + dto.quantity : undefined,
        },
      });

      // 2. Sync Product Table Stock Quantity
      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: afterQty,
        },
      });

      // 3. Create Adjustment Log entry
      await tx.inventoryAdjustment.create({
        data: {
          inventoryId: inventory.id,
          type: dto.type.toLowerCase(),
          quantity: diff,
          reason: dto.reason || 'Manual Adjustment',
          performedBy: userId,
        },
      });

      return updatedInventory;
    });
  }

  async getMovements(agencyId: string, storeId: string) {
    if (!storeId) {
      throw new BadRequestException('Store context is required');
    }

    return this.prisma.inventoryAdjustment.findMany({
      where: {
        inventory: {
          storeId,
        },
      },
      include: {
        inventory: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
