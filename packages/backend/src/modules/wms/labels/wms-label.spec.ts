import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateWmsLabelDto } from './dto/create-wms-label.dto';
import { WmsLabelService } from './wms-label.service';

/**
 * The label endpoint stopped inventing a shipment id.
 *
 * Both halves are pinned here because both produced the same symptom — a
 * foreign key violation surfacing as a 500 — from opposite directions: a body
 * with no shipmentId at all, and a body carrying one that belongs to nobody.
 */
describe('POST /api/wms/labels — no invented shipment id', () => {
  describe('body validation', () => {
    const errorsFor = async (body: unknown) =>
      validate(plainToInstance(CreateWmsLabelDto, body));

    it('names shipmentId when it is missing instead of substituting one', async () => {
      const errors = await errorsFor({ orderId: 'ord-1' });

      expect(errors.map((e) => e.property)).toEqual(['shipmentId']);
      expect(JSON.stringify(errors)).toContain('shipmentId zorunludur');
    });

    it('names orderId when it is missing', async () => {
      const errors = await errorsFor({ shipmentId: 'shp-1' });

      expect(errors.map((e) => e.property)).toEqual(['orderId']);
    });

    it('rejects a blank shipmentId, not just an absent one', async () => {
      const errors = await errorsFor({ orderId: 'ord-1', shipmentId: '   ' });

      // A whitespace id would reach the database and fail there instead.
      expect(errors.map((e) => e.property)).toEqual(['shipmentId']);
    });

    it('accepts a body with both', async () => {
      expect(await errorsFor({ orderId: 'ord-1', shipmentId: 'shp-1' })).toHaveLength(0);
    });
  });

  describe('service', () => {
    let service: WmsLabelService;

    const prisma: any = {
      order: { findFirst: jest.fn() },
      shipment: { findFirst: jest.fn() },
      wmsShippingLabel: { create: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [WmsLabelService, { provide: PrismaService, useValue: prisma }],
      }).compile();

      service = module.get(WmsLabelService);
      jest.clearAllMocks();

      prisma.order.findFirst.mockResolvedValue({ id: 'ord-1', agencyId: 'ag-1' });
      prisma.shipment.findFirst.mockResolvedValue({ id: 'shp-1' });
      prisma.wmsShippingLabel.create.mockResolvedValue({ id: 'lbl-1' });
      prisma.wmsShippingLabel.update.mockResolvedValue({ id: 'lbl-1' });
      prisma.auditLog.create.mockResolvedValue({});
    });

    it('answers 404 for a shipment the tenant does not have, rather than hitting the FK', async () => {
      prisma.shipment.findFirst.mockResolvedValue(null);

      await expect(
        service.createShippingLabel('ag-1', 'shp-elsewhere', 'ord-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      // Nothing was written, so no P2003 could be raised.
      expect(prisma.wmsShippingLabel.create).not.toHaveBeenCalled();
    });

    it('looks the shipment up inside the caller\'s agency', async () => {
      await service.createShippingLabel('ag-1', 'shp-1', 'ord-1', 'user-1');

      expect(prisma.shipment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'shp-1', agencyId: 'ag-1', deletedAt: null }),
        }),
      );
    });

    it('writes the label against the id it was given', async () => {
      await service.createShippingLabel('ag-1', 'shp-1', 'ord-1', 'user-1');

      expect(prisma.wmsShippingLabel.create.mock.calls[0][0].data).toMatchObject({
        agencyId: 'ag-1',
        orderId: 'ord-1',
        shipmentId: 'shp-1',
      });
    });
  });
});
