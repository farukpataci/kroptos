import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class WarehouseLocationService {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    return this.prisma.warehouseLocation.findMany({
      where: {
        warehouse: {
          agencyId,
        },
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, agencyId: string) {
    return this.prisma.warehouseLocation.findFirst({
      where: {
        id,
        warehouse: {
          agencyId,
        },
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
      },
    });
  }

  async create(data: any, agencyId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: data.warehouseId, agencyId },
    });
    if (!warehouse) {
      throw new Error('Warehouse not found or unauthorized');
    }

    return this.prisma.warehouseLocation.create({
      data: {
        warehouseId: data.warehouseId,
        zoneId: data.zoneId,
        code: data.code,
        aisle: data.aisle,
        shelf: data.shelf,
        bin: data.bin,
        level: data.level,
        barcode: data.barcode,
        capacity: data.capacity !== undefined ? Number(data.capacity) : 0,
        pickPriority: data.pickPriority !== undefined ? Number(data.pickPriority) : 0,
        isActive: data.status === 'active' || data.isActive === true,
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
      },
    });
  }

  async update(id: string, data: any, agencyId: string) {
    const existing = await this.prisma.warehouseLocation.findFirst({
      where: { id, warehouse: { agencyId } },
    });
    if (!existing) {
      throw new Error('Warehouse Location not found');
    }

    return this.prisma.warehouseLocation.update({
      where: { id },
      data: {
        warehouseId: data.warehouseId || existing.warehouseId,
        zoneId: data.zoneId || existing.zoneId,
        code: data.code,
        aisle: data.aisle,
        shelf: data.shelf,
        bin: data.bin,
        level: data.level,
        barcode: data.barcode,
        capacity: data.capacity !== undefined ? Number(data.capacity) : undefined,
        pickPriority: data.pickPriority !== undefined ? Number(data.pickPriority) : undefined,
        isActive: data.status !== undefined ? data.status === 'active' : data.isActive,
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        zone: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
      },
    });
  }

  async remove(id: string, agencyId: string) {
    const existing = await this.prisma.warehouseLocation.findFirst({
      where: { id, warehouse: { agencyId } },
    });
    if (!existing) {
      throw new Error('Warehouse Location not found');
    }

    return this.prisma.warehouseLocation.delete({
      where: { id },
    });
  }
}
