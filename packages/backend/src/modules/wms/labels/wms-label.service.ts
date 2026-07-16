import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class WmsLabelService {
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
          entityId: 'wms-shipping-label',
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

  async createShippingLabel(
    agencyId: string,
    shipmentId: string,
    orderId: string,
    performedBy: string,
    ipAddress?: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, agencyId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' not found.`);
    }

    const carrierName = 'Yurtici Kargo';
    const trackingNumber = `YK-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const barcode = `YK${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const label = await this.prisma.wmsShippingLabel.create({
      data: {
        agencyId,
        orderId,
        shipmentId,
        carrierName,
        trackingNumber,
        barcode,
        labelFormat: 'PDF',
        status: 'pending',
      },
    });

    // Update with mock preview URL pointing to preview endpoint
    const updated = await this.prisma.wmsShippingLabel.update({
      where: { id: label.id },
      data: {
        previewUrl: `/api/wms/labels/${label.id}/preview`,
        labelUrl: `/api/wms/labels/${label.id}/preview`,
      },
    });

    await this.writeWmsAuditLog(
      'wms.label.created',
      performedBy,
      agencyId,
      ipAddress,
      { labelId: label.id, trackingNumber },
    );

    return updated;
  }

  async getLatestLabel(agencyId: string) {
    return this.prisma.wmsShippingLabel.findFirst({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLabelPreview(agencyId: string, labelId: string, performedBy: string, ipAddress?: string) {
    const label = await this.prisma.wmsShippingLabel.findFirst({
      where: { id: labelId, agencyId },
    });

    if (!label) {
      throw new NotFoundException(`Shipping label with ID '${labelId}' not found.`);
    }

    // Fetch order if associated to enrich preview data
    let orderDetails = null;
    if (label.orderId) {
      orderDetails = await this.prisma.order.findUnique({
        where: { id: label.orderId },
      });
    }

    await this.writeWmsAuditLog(
      'wms.label_preview.opened',
      performedBy,
      agencyId,
      ipAddress,
      { labelId },
    );

    return {
      labelId: label.id,
      carrierName: label.carrierName,
      trackingNumber: label.trackingNumber,
      barcode: label.barcode,
      labelFormat: label.labelFormat,
      orderNumber: orderDetails?.orderNumber || 'MOCK-10023',
      customerName: orderDetails?.customerName || 'Ahmet Yilmaz',
      shippingAddress: orderDetails?.shippingAddress || 'Barbaros Mah. Kardelen Sok. No:2/1, Atasehir / Istanbul',
      totalAmount: orderDetails?.totalAmount || '249.90',
      currency: orderDetails?.currency || 'TRY',
      createdAt: label.createdAt,
    };
  }
}
