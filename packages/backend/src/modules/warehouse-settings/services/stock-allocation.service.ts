import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class StockAllocationService {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    return this.prisma.stockAllocationRule.findMany({
      where: { agencyId }
    });
  }

  async create(data: any, agencyId: string) {
    return this.prisma.stockAllocationRule.create({
      data: { ...data, agencyId }
    });
  }

  async calculate(data: any) {
    const actualStock = Number(data.actualStock || 0);
    const reservedStock = Number(data.reservedStock || 0);
    const safetyStock = Number(data.safetyStock || 0);
    const damagedStock = Number(data.damagedStock || 0);
    const reserveRatio = Number(data.reserveRatio || 0);
    const percentAllocation = Number(data.percentAllocation || 100);
    const fixedAllocation = Number(data.fixedAllocation || 0);
    const allocationType = data.allocationType || 'ALL_STOCK';

    // Satılabilir Stok = Gerçek Stok - Rezerve Stok - Güvenlik Stoğu - Hasarlı Stok
    const sellableStock = Math.max(0, actualStock - reservedStock - safetyStock - damagedStock);

    let allocatedStock = 0;
    if (allocationType === 'FIXED') {
      allocatedStock = Math.min(sellableStock, fixedAllocation);
    } else if (allocationType === 'PERCENT') {
      allocatedStock = Math.floor(sellableStock * (percentAllocation / 100));
    } else {
      allocatedStock = sellableStock;
    }

    // Reserve ratio adjustment
    if (reserveRatio > 0) {
      allocatedStock = Math.max(0, allocatedStock - Math.floor(allocatedStock * (reserveRatio / 100)));
    }

    return {
      actualStock,
      sellableStock,
      allocatedStock,
      riskLevel: sellableStock <= safetyStock ? 'HIGH' : 'LOW'
    };
  }
}
