import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class WarehouseZoneService {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    return this.prisma.warehouseZone.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, agencyId: string) {
    return this.prisma.warehouseZone.findFirst({
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

    return this.prisma.warehouseZone.create({
      data: {
        warehouseId: data.warehouseId,
        name: data.name,
        code: data.code,
        type: data.type || 'storage',
        priority: data.priority !== undefined ? Number(data.priority) : 0,
        description: data.description,
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
      },
    });
  }

  async update(id: string, data: any, agencyId: string) {
    const existing = await this.prisma.warehouseZone.findFirst({
      where: { id, warehouse: { agencyId } },
    });
    if (!existing) {
      throw new Error('Warehouse Zone not found');
    }

    return this.prisma.warehouseZone.update({
      where: { id },
      data: {
        warehouseId: data.warehouseId || existing.warehouseId,
        name: data.name,
        code: data.code,
        type: data.type,
        priority: data.priority !== undefined ? Number(data.priority) : undefined,
        description: data.description,
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
      },
    });
  }

  async remove(id: string, agencyId: string) {
    const existing = await this.prisma.warehouseZone.findFirst({
      where: { id, warehouse: { agencyId } },
    });
    if (!existing) {
      throw new Error('Warehouse Zone not found');
    }

    return this.prisma.warehouseZone.delete({
      where: { id },
    });
  }
}
