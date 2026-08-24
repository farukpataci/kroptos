import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '@common/prisma/prisma.service';
import { ShipmentService } from '../../shipment/shipment.service';
import { CreateWmsLabelDto } from './dto/create-wms-label.dto';
import { WmsLabelService } from './wms-label.service';

/**
 * The label endpoint stopped inventing things.
 *
 * It used to invent three: a shipment id, a carrier name, and a tracking
 * number. Each is pinned here from the side that would let it come back — a
 * body that omits the measurement, an order with no delivery address, a store
 * with no carrier connected.
 */
describe('POST /api/wms/labels', () => {
  const parcel = { weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 };

  describe('body validation', () => {
    const errorsFor = async (body: unknown) =>
      validate(plainToInstance(CreateWmsLabelDto, body));

    it('refuses a request with no parcels rather than assuming a box size', async () => {
      const errors = await errorsFor({ orderId: 'ord-1' });

      expect(errors.map((e) => e.property)).toEqual(['parcels']);
      // Desi sets the price. A default here would invoice a parcel nobody measured.
      expect(JSON.stringify(errors)).toContain('olculmemis');
    });

    it('refuses an empty parcels array', async () => {
      const errors = await errorsFor({ orderId: 'ord-1', parcels: [] });

      expect(errors.map((e) => e.property)).toEqual(['parcels']);
    });

    it('refuses a parcel missing a dimension', async () => {
      const errors = await errorsFor({
        orderId: 'ord-1',
        parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10 }],
      });

      expect(errors.map((e) => e.property)).toEqual(['parcels']);
    });

    it('accepts several boxes for one order', async () => {
      const errors = await errorsFor({ orderId: 'ord-1', parcels: [parcel, parcel, parcel] });

      expect(errors).toHaveLength(0);
    });

    it('no longer takes a shipment id from the caller', async () => {
      // forbidNonWhitelisted is on globally, so an unknown key is a 400 rather
      // than something quietly ignored.
      expect(Object.keys(plainToInstance(CreateWmsLabelDto, { orderId: 'o', parcels: [parcel] })))
        .not.toContain('shipmentId');
    });
  });

  /**
   * What is left of this endpoint once the shipment half moved.
   *
   * The address, the carrier choice and the idempotent shipment are
   * ShipmentService.createForOrder's job now and are pinned there — asserting
   * them here too would pin a delegation rather than a behaviour, and would go
   * green the day this service quietly grew its own copy again.
   */
  describe('service', () => {
    let service: WmsLabelService;

    const prisma: any = {
      wmsShippingLabel: { create: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const shipments: any = { createForOrder: jest.fn() };

    const order = { id: 'ord-1', orderNumber: 'ORD-1' };
    const integration = { id: 'ci-1', displayName: 'Yurtici Kargo', provider: 'YURTICI' };
    const shipment = {
      id: 'shp-1',
      trackingNumber: 'TRK-REAL',
      barcode: 'BC-REAL',
      labelFormat: 'PDF',
    };

    const dto = (over: any = {}) => ({ orderId: 'ord-1', parcels: [parcel], ...over });

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WmsLabelService,
          { provide: PrismaService, useValue: prisma },
          { provide: ShipmentService, useValue: shipments },
        ],
      }).compile();

      service = module.get(WmsLabelService);
      jest.clearAllMocks();

      prisma.wmsShippingLabel.create.mockResolvedValue({ id: 'lbl-1' });
      prisma.wmsShippingLabel.update.mockResolvedValue({ id: 'lbl-1' });
      prisma.auditLog.create.mockResolvedValue({});
      shipments.createForOrder.mockResolvedValue({ order, integration, shipment });
    });

    it('takes the carrier name and tracking number from the shipment, not from a constant', async () => {
      await service.createShippingLabel('ag-1', dto() as any, 'user-1');

      expect(prisma.wmsShippingLabel.create.mock.calls[0][0].data).toMatchObject({
        shipmentId: 'shp-1',
        carrierName: 'Yurtici Kargo',
        trackingNumber: 'TRK-REAL',
        barcode: 'BC-REAL',
      });
    });

    it('hands the body straight to the shared shipment path', async () => {
      const body = dto({ parcels: [parcel, { ...parcel, weightKg: 5 }], paymentType: 'cod' });

      await service.createShippingLabel('ag-1', body as any, 'user-1');

      expect(shipments.createForOrder).toHaveBeenCalledWith('ag-1', body);
    });

    it('refuses to print a label for a shipment that has no barcode', async () => {
      shipments.createForOrder.mockResolvedValue({
        order,
        integration,
        shipment: { id: 'shp-stuck', trackingNumber: null, barcode: null },
      });

      const error = await service
        .createShippingLabel('ag-1', dto() as any, 'user-1')
        .catch((e) => e);

      expect(error.getResponse()).toMatchObject({ code: 'SHIPMENT_WITHOUT_BARCODE' });
      expect(prisma.wmsShippingLabel.create).not.toHaveBeenCalled();
    });

    it('lets a refusal from the shared path through untouched', async () => {
      shipments.createForOrder.mockRejectedValue(
        new BadRequestException({ code: 'NO_ACTIVE_CARRIER' }),
      );

      const error = await service
        .createShippingLabel('ag-1', dto() as any, 'user-1')
        .catch((e) => e);

      expect(error.getResponse()).toMatchObject({ code: 'NO_ACTIVE_CARRIER' });
      expect(prisma.wmsShippingLabel.create).not.toHaveBeenCalled();
    });

    it('reports a failed order without stopping the round', async () => {
      shipments.createForOrder
        .mockResolvedValueOnce({ order, integration, shipment })
        .mockRejectedValueOnce(new BadRequestException({ code: 'INCOMPLETE_SHIPPING_ADDRESS' }));

      const result = await service.createShippingLabelsBulk(
        'ag-1',
        [dto(), dto({ orderId: 'ord-2' })] as any,
        'user-1',
      );

      expect(result.created).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[1].error?.code).toBe('INCOMPLETE_SHIPPING_ADDRESS');
    });
  });
});
