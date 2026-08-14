import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class WarehouseService {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    return this.prisma.warehouse.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, agencyId: string) {
    return this.prisma.warehouse.findFirst({
      where: { id, agencyId },
    });
  }

  async create(data: any, agencyId: string) {
    return this.prisma.warehouse.create({
      data: {
        name: data.name,
        code: data.code,
        type: data.type || 'Ana Depo',
        address: data.address,
        isActive: data.status === 'active' || data.isActive === true,
        capacity: data.capacity !== undefined ? Number(data.capacity) : 5000,
        usedCapacity: data.usedCapacity !== undefined ? Number(data.usedCapacity) : 0,
        agencyId,
      },
    });
  }

  async update(id: string, data: any, agencyId: string) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id, agencyId },
    });
    if (!wh) {
      throw new Error('Warehouse not found');
    }
    return this.prisma.warehouse.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        type: data.type,
        address: data.address,
        isActive: data.status === 'active' || data.isActive === true,
        capacity: data.capacity !== undefined ? Number(data.capacity) : undefined,
        usedCapacity: data.usedCapacity !== undefined ? Number(data.usedCapacity) : undefined,
      },
    });
  }

  async remove(id: string, agencyId: string) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id, agencyId },
    });
    if (!wh) {
      throw new Error('Warehouse not found');
    }
    return this.prisma.warehouse.delete({
      where: { id },
    });
  }
}
