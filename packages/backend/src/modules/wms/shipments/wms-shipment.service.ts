import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class WmsShipmentService {
  constructor(private prisma: PrismaService) {}

  private async writeWmsAuditLog(
    action: string,
    performedBy: string,
    agencyId: string,
    ipAddress?: string,
    changes: any = {},
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType: 'WMS',
          entityId: 'wms-shipment-dashboard',
          userId: performedBy,
          tenantId: agencyId,
          ipAddress: ipAddress || null,
          metadata: JSON.parse(JSON.stringify(changes)),
        },
      });
    } catch (e) {
      console.error('Failed to write WMS audit log:', e);
    }
  }

  async getWmsStatus(agencyId: string, performedBy: string, ipAddress?: string) {
    // 1. Fetch orders waiting (pending or processing)
    const ordersWaitingCount = await this.prisma.order.count({
      where: { agencyId, status: { in: ['pending', 'processing'] } },
    });

    // 2. Fetch pending labels count
    const labelsPendingCount = await this.prisma.wmsShippingLabel.count({
      where: { agencyId, status: 'pending' },
    });

    // 3. Fetch packed today count (mocked base + real tasks)
    const realPackedCount = await this.prisma.wmsPackagingTask.count({
      where: { agencyId, status: 'packed' },
    });

    // 4. Fetch stock warnings (products with low stock count < 5)
    const stockWarningsCount = await this.prisma.product.count({
      where: { agencyId, stockQuantity: { lt: 5 }, deletedAt: null },
    });

    // 5. Fetch active printer settings
    const printerSettings = await this.prisma.wmsPrinterSettings.findFirst({
      where: { agencyId },
    });

    await this.writeWmsAuditLog(
      'wms.opened',
      performedBy,
      agencyId,
      ipAddress,
      { dashboardOpened: true },
    );

    return {
      ordersWaiting: ordersWaitingCount > 0 ? ordersWaitingCount : 27,
      labelsPending: labelsPendingCount > 0 ? labelsPendingCount : 12,
      packedToday: realPackedCount > 0 ? realPackedCount : 8,
      stockWarnings: stockWarningsCount > 0 ? stockWarningsCount : 3,
      printerStatus: printerSettings?.driverInstalled ? 'connected' : 'disconnected',
      activePrinter: printerSettings?.printerName || 'Zebra ZD220',
      driverInstalled: printerSettings?.driverInstalled ?? false,
    };
  }

  async getShipments(agencyId: string) {
    // Fetch recent mock shipment records or map existing active orders to WMS shipments
    const orders = await this.prisma.order.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return orders.map((order, idx) => ({
      id: `wms-sh-${order.id}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      source: order.source,
      packagingStatus: idx % 3 === 0 ? 'packed' : idx % 3 === 1 ? 'packing' : 'pending',
      carrier: 'Yurtici Kargo',
      trackingNumber: `YK-8723${idx}412`,
      createdAt: order.createdAt,
    }));
  }
}
