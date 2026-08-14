import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class LogoStockIntegrationService {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    return this.prisma.logoProductMapping.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, agencyId: string) {
    return this.prisma.logoProductMapping.findFirst({
      where: { id, agencyId },
    });
  }

  async create(data: any, agencyId: string) {
    return this.prisma.logoProductMapping.upsert({
      where: {
        agencyId_productSku: {
          agencyId,
          productSku: data.productSku,
        },
      },
      create: {
        agencyId,
        productSku: data.productSku,
        barcode: data.barcode || null,
        productName: data.productName || null,
        erpStockCode: data.erpStockCode,
        erpStockName: data.erpStockName || null,
        erpUnit: data.erpUnit || null,
        variantCode: data.variantCode || null,
        status: data.status || 'matched',
      },
      update: {
        barcode: data.barcode ?? undefined,
        productName: data.productName ?? undefined,
        erpStockCode: data.erpStockCode,
        erpStockName: data.erpStockName ?? undefined,
        erpUnit: data.erpUnit ?? undefined,
        variantCode: data.variantCode ?? undefined,
        status: data.status ?? undefined,
      },
    });
  }

  async update(id: string, data: any, agencyId: string) {
    return this.prisma.logoProductMapping.update({
      where: { id },
      data: {
        productSku: data.productSku ?? undefined,
        barcode: data.barcode ?? undefined,
        productName: data.productName ?? undefined,
        erpStockCode: data.erpStockCode ?? undefined,
        erpStockName: data.erpStockName ?? undefined,
        erpUnit: data.erpUnit ?? undefined,
        variantCode: data.variantCode ?? undefined,
        status: data.status ?? undefined,
      },
    });
  }

  async remove(id: string, agencyId: string) {
    return this.prisma.logoProductMapping.delete({
      where: { id },
    });
  }

  async getSettings(agencyId: string) {
    let settings = await this.prisma.erpStockSettings.findUnique({
      where: { agencyId },
    });
    if (!settings) {
      settings = await this.prisma.erpStockSettings.create({
        data: {
          agencyId,
          isActive: true,
          connectionType: 'SQL',
          companyNo: '001',
          periodNo: '01',
          erpDepotCodes: ['0', '1', '2'],
          erpStockCardField: 'CODE',
          erpBarcodeField: 'BARCODE',
          variantTracking: false,
          lotTracking: false,
          syncPeriodMinutes: 30,
          syncDirection: 'READ',
        },
      });
    }
    return settings;
  }

  async updateSettings(data: any, agencyId: string) {
    return this.prisma.erpStockSettings.upsert({
      where: { agencyId },
      create: {
        agencyId,
        isActive: data.isActive ?? true,
        connectionType: data.connectionType || 'SQL',
        companyNo: data.companyNo || '001',
        periodNo: data.periodNo || '01',
        erpDepotCodes: data.erpDepotCodes || ['0', '1', '2'],
        erpStockCardField: data.erpStockCardField || 'CODE',
        erpBarcodeField: data.erpBarcodeField || 'BARCODE',
        variantTracking: data.variantTracking ?? false,
        lotTracking: data.lotTracking ?? false,
        syncPeriodMinutes: data.syncPeriodMinutes || 30,
        syncDirection: data.syncDirection || 'READ',
      },
      update: {
        isActive: data.isActive ?? undefined,
        connectionType: data.connectionType ?? undefined,
        companyNo: data.companyNo ?? undefined,
        periodNo: data.periodNo ?? undefined,
        erpDepotCodes: data.erpDepotCodes ?? undefined,
        erpStockCardField: data.erpStockCardField ?? undefined,
        erpBarcodeField: data.erpBarcodeField ?? undefined,
        variantTracking: data.variantTracking ?? undefined,
        lotTracking: data.lotTracking ?? undefined,
        syncPeriodMinutes: data.syncPeriodMinutes ?? undefined,
        syncDirection: data.syncDirection ?? undefined,
      },
    });
  }
}
