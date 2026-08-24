import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '@common/prisma/prisma.service';
import { CarrierIntegrationService } from '../../shipment/carrier-integration.service';
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

  describe('service', () => {
    let service: WmsLabelService;

    const prisma: any = {
      order: { findFirst: jest.fn() },
      wmsShippingLabel: { create: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const shipments: any = { create: jest.fn() };
    const carriers: any = { resolveCarrierIntegration: jest.fn() };

    const order = {
      id: 'ord-1',
      agencyId: 'ag-1',
      clientId: null,
      storeId: 'st-1',
      orderNumber: 'ORD-1',
      currency: 'TRY',
      customerName: 'Ada Yilmaz',
      customerPhone: '05551112233',
      shippingFullName: null,
      shippingPhone: null,
      shippingLine1: 'Bahce sok. 3',
      shippingLine2: null,
      shippingDistrict: 'Kadikoy',
      shippingCity: 'Istanbul',
      shippingPostalCode: '34710',
      shippingCountryCode: 'TR',
    };

    const dto = (over: any = {}) => ({ orderId: 'ord-1', parcels: [parcel], ...over });

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WmsLabelService,
          { provide: PrismaService, useValue: prisma },
          { provide: ShipmentService, useValue: shipments },
          { provide: CarrierIntegrationService, useValue: carriers },
        ],
      }).compile();

      service = module.get(WmsLabelService);
      jest.clearAllMocks();

      prisma.order.findFirst.mockResolvedValue(order);
      prisma.wmsShippingLabel.create.mockResolvedValue({ id: 'lbl-1' });
      prisma.wmsShippingLabel.update.mockResolvedValue({ id: 'lbl-1' });
      prisma.auditLog.create.mockResolvedValue({});
      carriers.resolveCarrierIntegration.mockResolvedValue({
        id: 'ci-1',
        displayName: 'Yurtici Kargo',
        provider: 'YURTICI',
      });
      shipments.create.mockResolvedValue({
        id: 'shp-1',
        trackingNumber: 'TRK-REAL',
        barcode: 'BC-REAL',
        labelFormat: 'PDF',
      });
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

    it('creates the shipment in the order\'s own store', async () => {
      await service.createShippingLabel('ag-1', dto() as any, 'user-1');

      const [, scope] = shipments.create.mock.calls[0];
      expect(scope).toEqual({ agencyId: 'ag-1', clientId: null, storeId: 'st-1' });
    });

    it('hands every measured box through to the shipment', async () => {
      const three = [parcel, { ...parcel, weightKg: 5 }, { ...parcel, lengthCm: 40 }];

      await service.createShippingLabel('ag-1', dto({ parcels: three }) as any, 'user-1');

      expect(shipments.create.mock.calls[0][0].parcels).toEqual(three);
    });

    it('names the missing address fields instead of shipping to a partial address', async () => {
      prisma.order.findFirst.mockResolvedValue({
        ...order,
        shippingDistrict: null,
        shippingCity: '   ',
      });

      const error = await service
        .createShippingLabel('ag-1', dto() as any, 'user-1')
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({
        code: 'INCOMPLETE_SHIPPING_ADDRESS',
        missingFields: ['shippingDistrict', 'shippingCity'],
      });
      expect(shipments.create).not.toHaveBeenCalled();
    });

    it('falls back to the buyer for the recipient name and phone, but nothing else', async () => {
      await service.createShippingLabel('ag-1', dto() as any, 'user-1');

      expect(shipments.create.mock.calls[0][0].recipient).toMatchObject({
        fullName: 'Ada Yilmaz',
        phone: '05551112233',
        district: 'Kadikoy',
      });
    });

    it('lets the carrier refusal through untouched', async () => {
      carriers.resolveCarrierIntegration.mockRejectedValue(
        new BadRequestException({ code: 'NO_ACTIVE_CARRIER' }),
      );

      const error = await service
        .createShippingLabel('ag-1', dto() as any, 'user-1')
        .catch((e) => e);

      expect(error.getResponse()).toMatchObject({ code: 'NO_ACTIVE_CARRIER' });
      expect(prisma.wmsShippingLabel.create).not.toHaveBeenCalled();
    });

    it('refuses to print a label for a shipment that has no barcode', async () => {
      shipments.create.mockResolvedValue({ id: 'shp-stuck', trackingNumber: null, barcode: null });

      const error = await service
        .createShippingLabel('ag-1', dto() as any, 'user-1')
        .catch((e) => e);

      expect(error.getResponse()).toMatchObject({ code: 'SHIPMENT_WITHOUT_BARCODE' });
      expect(prisma.wmsShippingLabel.create).not.toHaveBeenCalled();
    });

    it('requires the amount when the parcel is paid on delivery', async () => {
      const error = await service
        .createShippingLabel('ag-1', dto({ paymentType: 'cod' }) as any, 'user-1')
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(shipments.create).not.toHaveBeenCalled();
    });

    it('answers 404 for an order outside the agency', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.createShippingLabel('ag-1', dto() as any, 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
