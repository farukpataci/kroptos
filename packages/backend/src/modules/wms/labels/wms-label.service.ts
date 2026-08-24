import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { ShipmentService } from '../../shipment/shipment.service';
import { CreateWmsLabelDto } from './dto/create-wms-label.dto';

@Injectable()
export class WmsLabelService {
  constructor(
    private prisma: PrismaService,
    private shipments: ShipmentService,
  ) {}

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

  /**
   * Prints a label by creating the shipment it is a label for.
   *
   * The carrier name and the tracking number used to be invented here: a fixed
   * 'Yurtici Kargo' and a random number no carrier had ever issued. Both now
   * come from the connector's answer, and the label row points at the Shipment
   * through a real foreign key.
   *
   * The shipment is created in the order's own store, not the caller's active
   * one. The order was already fetched inside the caller's agency, and a label
   * belongs to the store that sold the thing.
   */
  async createShippingLabel(
    agencyId: string,
    dto: CreateWmsLabelDto,
    performedBy: string,
    ipAddress?: string,
  ) {
    // The order lookup, the address, the carrier choice and the idempotent
    // shipment all live in ShipmentService now — this endpoint and
    // POST /api/shipments/bulk go through the same body, so they cannot drift
    // apart about where a recipient address may come from.
    const { order, integration, shipment } = await this.shipments.createForOrder(agencyId, dto);

    if (!shipment.trackingNumber || !shipment.barcode) {
      // The claim row exists but the carrier never came back with a barcode.
      // Printing a label without one puts a parcel in a van with nothing to
      // scan.
      throw new BadRequestException({
        code: 'SHIPMENT_WITHOUT_BARCODE',
        messageKey: 'shipping.errors.shipmentWithoutBarcode',
        message:
          'Gonderi olusturuldu ancak tasiyicidan barkod alinamadi; etiket basilamaz.',
        shipmentId: shipment.id,
      });
    }

    const label = await this.prisma.wmsShippingLabel.create({
      data: {
        agencyId,
        orderId: order.id,
        shipmentId: shipment.id,
        carrierName: integration.displayName,
        trackingNumber: shipment.trackingNumber,
        barcode: shipment.barcode,
        labelFormat: shipment.labelFormat ?? 'PDF',
        status: 'pending',
      },
    });

    const updated = await this.prisma.wmsShippingLabel.update({
      where: { id: label.id },
      data: {
        previewUrl: `/api/wms/labels/${label.id}/preview`,
        labelUrl: `/api/wms/labels/${label.id}/preview`,
      },
    });

    await this.writeWmsAuditLog('wms.label.created', performedBy, agencyId, ipAddress, {
      labelId: label.id,
      shipmentId: shipment.id,
      provider: integration.provider,
      trackingNumber: shipment.trackingNumber,
      parcelCount: dto.parcels.length,
    });

    return updated;
  }

  /**
   * A packing round, one order at a time behind one request.
   *
   * Deliberately sequential and deliberately not transactional. Each entry buys
   * a barcode from a carrier, and a rollback cannot un-buy one: an order that
   * succeeded must keep its label even when the next order fails. So every
   * failure is reported against its own order and the round continues — the
   * packer sees which parcels are ready and which need another look, instead of
   * a batch that either all worked or all appears not to have.
   */
  async createShippingLabelsBulk(
    agencyId: string,
    items: CreateWmsLabelDto[],
    performedBy: string,
    ipAddress?: string,
  ) {
    const results: {
      orderId: string;
      success: boolean;
      label?: unknown;
      error?: { code?: string; message: string };
    }[] = [];

    for (const item of items) {
      try {
        results.push({
          orderId: item.orderId,
          success: true,
          label: await this.createShippingLabel(agencyId, item, performedBy, ipAddress),
        });
      } catch (error: any) {
        // The structured refusals (NO_ACTIVE_CARRIER, AMBIGUOUS_CARRIER,
        // INCOMPLETE_SHIPPING_ADDRESS, SHIPMENT_WITHOUT_BARCODE) are passed
        // through as they are: the screen needs the code, not a sentence.
        const body = error?.response ?? {};
        results.push({
          orderId: item.orderId,
          success: false,
          error: {
            code: body.code,
            message: body.message ?? error?.message ?? 'Etiket olusturulamadi.',
          },
        });
      }
    }

    return {
      created: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
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
