import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@common/prisma/prisma.service';
import { ShipmentService } from './shipment.service';
import { CarrierIntegrationService } from './carrier-integration.service';
import { CreateShipmentDto } from './dto/shipment.dto';

/**
 * These pin the one invariant that costs real money: an order must never end up
 * with two barcodes. Every path that must NOT reach the carrier asserts on
 * `createShipment` not having been called.
 */
describe('ShipmentService.create — idempotency', () => {
  let service: ShipmentService;

  const createShipment = jest.fn();
  const integration = {
    id: 'ci-1',
    provider: 'YURTICI',
    displayName: 'Yurtiçi Kargo',
    isActive: true,
    isTestMode: true,
    settings: {},
    senderAddress: { fullName: 'Depo', city: 'İstanbul' },
  };

  const prisma: any = {
    shipment: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const carriers: any = {
    findOneOrFail: jest.fn().mockResolvedValue(integration),
    connectorFor: jest.fn(() => ({ createShipment })),
  };

  const scope = { agencyId: 'ag-1', storeId: 'st-1', clientId: null } as any;

  const dto = (over: Partial<CreateShipmentDto> = {}): CreateShipmentDto =>
    ({
      carrierIntegrationId: 'ci-1',
      orderId: 'ord-7',
      orderNumber: 'ORD-7',
      recipient: { fullName: 'Ada', city: 'Ankara' },
      parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
      paymentType: 'sender_pays',
      ...over,
    }) as CreateShipmentDto;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: CarrierIntegrationService, useValue: carriers },
      ],
    }).compile();

    service = module.get(ShipmentService);
    jest.clearAllMocks();

    carriers.findOneOrFail.mockResolvedValue(integration);
    carriers.connectorFor.mockReturnValue({ createShipment });
    prisma.shipment.count.mockResolvedValue(0);
    prisma.shipment.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'shp-1', ...data }),
    );
    prisma.shipment.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'shp-1', ...data }),
    );
    createShipment.mockResolvedValue({ trackingNumber: 'TRK-1', barcode: 'BC-1' });
  });

  it('returns the live shipment without calling the carrier again', async () => {
    prisma.shipment.findFirst.mockResolvedValue({ id: 'shp-old', trackingNumber: 'TRK-OLD' });

    const result = await service.create(dto(), scope);

    expect(result).toMatchObject({ id: 'shp-old' });
    expect(createShipment).not.toHaveBeenCalled();
    expect(prisma.shipment.create).not.toHaveBeenCalled();
  });

  it('excludes cancelled shipments from the live lookup', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);

    await service.create(dto(), scope);

    const where = prisma.shipment.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      agencyId: 'ag-1',
      storeId: 'st-1',
      orderId: 'ord-7',
      status: { not: 'cancelled' },
    });
  });

  it('uses the order id as the reference code on the first attempt', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);

    await service.create(dto(), scope);

    expect(prisma.shipment.create.mock.calls[0][0].data.referenceCode).toBe('ord-7');
  });

  it('numbers the reference code after a cancellation', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);
    prisma.shipment.count.mockResolvedValue(1); // one cancelled attempt on record

    await service.create(dto(), scope);

    expect(prisma.shipment.create.mock.calls[0][0].data.referenceCode).toBe('ord-7:2');
  });

  it('writes the claim row before the carrier is called, with no tracking number', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);
    const order: string[] = [];
    prisma.shipment.create.mockImplementation(({ data }: any) => {
      order.push('create');
      return Promise.resolve({ id: 'shp-1', ...data });
    });
    createShipment.mockImplementation(() => {
      order.push('carrier');
      return Promise.resolve({ trackingNumber: 'TRK-1' });
    });

    await service.create(dto(), scope);

    expect(order).toEqual(['create', 'carrier']);
    const claim = prisma.shipment.create.mock.calls[0][0].data;
    expect(claim.status).toBe('created');
    expect(claim.trackingNumber).toBeUndefined();
  });

  it('yields to the winner on P2002 instead of buying a second barcode', async () => {
    prisma.shipment.findFirst
      .mockResolvedValueOnce(null) // live lookup: nothing yet
      .mockResolvedValueOnce({ id: 'shp-winner', referenceCode: 'ord-7' });
    prisma.shipment.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['agencyId', 'storeId', 'referenceCode'] },
      }),
    );

    const result = await service.create(dto(), scope);

    expect(result).toMatchObject({ id: 'shp-winner' });
    expect(createShipment).not.toHaveBeenCalled();
  });

  it('rethrows a duplicate tracking number rather than treating it as a race', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);
    prisma.shipment.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['provider', 'trackingNumber'] },
      }),
    );

    await expect(service.create(dto(), scope)).rejects.toThrow();
    expect(createShipment).not.toHaveBeenCalled();
  });

  it('leaves the claim row behind when the carrier call fails', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);
    createShipment.mockRejectedValue(new Error('carrier timeout'));

    await expect(service.create(dto(), scope)).rejects.toThrow('carrier timeout');

    // Written, never rolled back: a timeout may still have bought a barcode.
    expect(prisma.shipment.create).toHaveBeenCalled();
    expect(prisma.shipment.update).not.toHaveBeenCalled();
  });

  it('hands the carrier measured parcels and the tenant divisor', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);
    carriers.findOneOrFail.mockResolvedValue({ ...integration, settings: { desiDivisor: 5000 } });

    await service.create(dto(), scope);

    const req = createShipment.mock.calls[0][0];
    // 10*10*10 / 5000 — the tenant's tariff, not the 3000 default a connector
    // would reach for if it had to compute this itself.
    expect(req.desiDivisor).toBe(5000);
    expect(req.parcels[0].desi).toBe(0.2);
    expect(req.parcels[0].chargeableWeightKg).toBe(1);
  });

  it('persists the chargeable weight on the shipment and on each package', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);

    await service.create(dto(), scope);

    const data = prisma.shipment.create.mock.calls[0][0].data;
    expect(data.chargeableWeightKg).toBe(1); // max(1 kg, 0.33 desi)
    expect(data.packages.create[0]).toMatchObject({ desi: 0.33, chargeableWeightKg: 1 });
  });

  it('fills the tracking number in only after the carrier answers', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);
    createShipment.mockResolvedValue({
      trackingNumber: 'TRK-9',
      barcode: 'BC-9',
      labelUrl: 'https://label',
    });

    await service.create(dto(), scope);

    expect(prisma.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'shp-1' },
        data: expect.objectContaining({
          trackingNumber: 'TRK-9',
          barcode: 'BC-9',
          labelUrl: 'https://label',
          status: 'label_ready',
        }),
      }),
    );
  });
});


/**
 * The carrier owns its barcode; it does not own our order state. These pin that
 * a refusal is recorded, never allowed to block the cancellation.
 */
describe('ShipmentService.cancel — two steps', () => {
  let service: ShipmentService;

  const cancelShipment = jest.fn();
  const prisma: any = {
    shipment: { findFirst: jest.fn(), update: jest.fn() },
    shipmentTrackingEvent: { create: jest.fn() },
  };
  const carriers: any = {
    findOneOrFail: jest.fn(),
    connectorFor: jest.fn(() => ({ cancelShipment })),
  };
  const scope = { agencyId: 'ag-1', storeId: 'st-1', clientId: null } as any;

  const shipment = (over: Record<string, unknown> = {}) => ({
    id: 'shp-1',
    status: 'label_ready',
    trackingNumber: 'TRK-1',
    carrierIntegrationId: 'ci-1',
    carrierCancelledAt: null,
    ...over,
  });

  const cancelData = () => prisma.shipment.update.mock.calls[0][0].data;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: CarrierIntegrationService, useValue: carriers },
      ],
    }).compile();

    service = module.get(ShipmentService);
    jest.clearAllMocks();

    carriers.findOneOrFail.mockResolvedValue({ id: 'ci-1', provider: 'MOCK', settings: {} });
    carriers.connectorFor.mockReturnValue({ cancelShipment });
    prisma.shipment.update.mockResolvedValue({});
    prisma.shipmentTrackingEvent.create.mockResolvedValue({});
    cancelShipment.mockResolvedValue({ success: true });
  });

  it('records the carrier confirmation when it succeeds', async () => {
    prisma.shipment.findFirst.mockResolvedValue(shipment());

    const result = await service.cancel('shp-1', scope, {} as any);

    expect(result).toMatchObject({ success: true, carrierCancelled: true });
    expect(cancelData()).toMatchObject({ status: 'cancelled', carrierCancelError: null });
    expect(cancelData().cancelledAt).toBeInstanceOf(Date);
    expect(cancelData().carrierCancelledAt).toBeInstanceOf(Date);
  });

  it('cancels anyway when the carrier refuses, and keeps the refusal', async () => {
    prisma.shipment.findFirst.mockResolvedValue(shipment());
    cancelShipment.mockResolvedValue({ success: false, message: 'Barkod okutulmuş' });

    const result = await service.cancel('shp-1', scope, {} as any);

    expect(result).toMatchObject({ success: true, carrierCancelled: false });
    expect(cancelData().status).toBe('cancelled');
    expect(cancelData().cancelledAt).toBeInstanceOf(Date);
    // Never confirmed, so it must stay empty: someone has to chase that barcode.
    expect(cancelData().carrierCancelledAt).toBeNull();
    expect(cancelData().carrierCancelError).toContain('Barkod okutulmuş');
  });

  it('cancels anyway when the carrier call throws', async () => {
    prisma.shipment.findFirst.mockResolvedValue(shipment());
    cancelShipment.mockRejectedValue(new Error('carrier timeout'));

    const result = await service.cancel('shp-1', scope, {} as any);

    expect(result.carrierCancelled).toBe(false);
    expect(cancelData().status).toBe('cancelled');
    expect(cancelData().carrierCancelError).toContain('carrier timeout');
  });

  it('clears a stuck claim without calling the carrier at all', async () => {
    // status 'created' with no tracking number: the createShipment call never
    // came back. Cancelling locally is the documented way out.
    prisma.shipment.findFirst.mockResolvedValue(shipment({ status: 'created', trackingNumber: null }));

    const result = await service.cancel('shp-1', scope, {} as any);

    expect(cancelShipment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, carrierCancelled: false });
    expect(cancelData().status).toBe('cancelled');
    expect(cancelData().carrierCancelError).toBeNull();
  });

  it('is a no-op on an already cancelled shipment', async () => {
    prisma.shipment.findFirst.mockResolvedValue(shipment({ status: 'cancelled' }));

    await service.cancel('shp-1', scope, {} as any);

    expect(cancelShipment).not.toHaveBeenCalled();
    expect(prisma.shipment.update).not.toHaveBeenCalled();
  });
});

describe('ShipmentService.refresh — tracking events', () => {
  let service: ShipmentService;

  const track = jest.fn();
  const prisma: any = {
    shipment: { findFirst: jest.fn(), update: jest.fn() },
    shipmentTrackingEvent: { create: jest.fn() },
  };
  const carriers: any = {
    findOneOrFail: jest.fn(),
    connectorFor: jest.fn(() => ({ track })),
  };
  const scope = { agencyId: 'ag-1', storeId: 'st-1', clientId: null } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: CarrierIntegrationService, useValue: carriers },
      ],
    }).compile();

    service = module.get(ShipmentService);
    jest.clearAllMocks();

    carriers.findOneOrFail.mockResolvedValue({ id: 'ci-1', provider: 'MOCK', settings: {} });
    carriers.connectorFor.mockReturnValue({ track });
    prisma.shipment.findFirst.mockResolvedValue({
      id: 'shp-1',
      trackingNumber: 'TRK-1',
      carrierIntegrationId: 'ci-1',
      deliveredAt: null,
    });
    prisma.shipment.update.mockResolvedValue({});
    prisma.shipmentTrackingEvent.create.mockResolvedValue({});
  });

  it("stores each event's own carrier code, not the shipment-level one", async () => {
    track.mockResolvedValue([
      {
        trackingNumber: 'TRK-1',
        status: 'out_for_delivery',
        carrierStatusCode: 'C_OUT',
        events: [
          {
            at: new Date('2026-08-20T09:00:00Z'),
            status: 'in_transit',
            carrierStatusCode: 'C_TRANSFER',
            description: 'Transfer merkezinde',
          },
          {
            at: new Date('2026-08-20T11:00:00Z'),
            status: 'out_for_delivery',
            carrierStatusCode: 'C_OUT',
            description: 'Dağıtımda',
          },
        ],
      },
    ]);

    await service.refresh('shp-1', scope);

    const codes = prisma.shipmentTrackingEvent.create.mock.calls.map(
      (call: any) => call[0].data.carrierStatusCode,
    );
    // Two distinct codes: with the shipment-level code copied onto both, the
    // unique key would collapse them into one row and lose an event.
    expect(codes).toEqual(['C_TRANSFER', 'C_OUT']);
    // The shipment row still carries the normalised status plus the top code.
    expect(prisma.shipment.update.mock.calls[0][0].data).toMatchObject({
      status: 'out_for_delivery',
      carrierStatusCode: 'C_OUT',
    });
  });
});

/**
 * The guards added in the second pass. Each one exists because the failure it
 * prevents is silent: a wrong status, a swallowed write, a shipment that goes
 * unmanageable, a list that hands out customer addresses.
 */
describe('ShipmentService — tracking, cancel and list guards', () => {
  let service: ShipmentService;

  const track = jest.fn();
  const integration = { id: 'ci-1', provider: 'YURTICI', isActive: true, isTestMode: true, settings: {} };
  const shipment = { id: 'shp-1', trackingNumber: 'TRK-1', carrierIntegrationId: 'ci-1', deliveredAt: null };

  const prisma: any = {
    shipment: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    shipmentTrackingEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const carriers: any = { findOneOrFail: jest.fn(), connectorFor: jest.fn() };
  const scope = { agencyId: 'ag-1', storeId: 'st-1', clientId: null } as any;

  const trackingEvent = (over: any = {}) => ({
    at: new Date('2026-08-23T10:00:00Z'),
    status: 'in_transit',
    carrierStatusCode: 'YK_TRANSFER',
    description: 'Transfer merkezinde',
    ...over,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: CarrierIntegrationService, useValue: carriers },
      ],
    }).compile();

    service = module.get(ShipmentService);
    jest.clearAllMocks();

    prisma.shipment.findFirst.mockResolvedValue(shipment);
    prisma.shipment.update.mockResolvedValue(shipment);
    prisma.shipmentTrackingEvent.create.mockResolvedValue({});
    carriers.findOneOrFail.mockResolvedValue(integration);
    carriers.connectorFor.mockReturnValue({ track });
    track.mockResolvedValue([
      { trackingNumber: 'TRK-1', status: 'in_transit', carrierStatusCode: 'YK_TRANSFER', events: [trackingEvent()] },
    ]);
  });

  it('refuses a status the mapper failed to normalise, before writing anything', async () => {
    track.mockResolvedValue([
      { trackingNumber: 'TRK-1', status: 'TESLIM_EDILDI', carrierStatusCode: 'YK_99', events: [] },
    ]);

    await expect(service.refresh('shp-1', scope)).rejects.toThrow(/TESLIM_EDILDI/);
    expect(prisma.shipment.update).not.toHaveBeenCalled();
    expect(prisma.shipmentTrackingEvent.create).not.toHaveBeenCalled();
  });

  it('refuses an unnormalised event status too, without persisting the good ones', async () => {
    track.mockResolvedValue([
      {
        trackingNumber: 'TRK-1',
        status: 'in_transit',
        carrierStatusCode: 'YK_TRANSFER',
        events: [trackingEvent(), trackingEvent({ status: 'DAGITIMDA' })],
      },
    ]);

    await expect(service.refresh('shp-1', scope)).rejects.toThrow(/DAGITIMDA/);
    expect(prisma.shipmentTrackingEvent.create).not.toHaveBeenCalled();
  });

  it('still reaches the carrier after the connection was soft deleted', async () => {
    await service.refresh('shp-1', scope);

    expect(carriers.findOneOrFail).toHaveBeenCalledWith('ci-1', scope, { includeDeleted: true });
  });

  it('swallows a duplicate event but not a real write failure', async () => {
    prisma.shipmentTrackingEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(service.refresh('shp-1', scope)).resolves.toBeDefined();

    prisma.shipmentTrackingEvent.create.mockRejectedValue(new Error('connection reset'));
    await expect(service.refresh('shp-1', scope)).rejects.toThrow('connection reset');
  });

  it('keeps recipient addresses out of the list payload', async () => {
    const row = {
      id: 'shp-1',
      publicId: 'shp_1',
      provider: 'YURTICI',
      status: 'in_transit',
      totalDesi: new Prisma.Decimal('0.33'),
      recipientAddress: { fullName: 'Ada', phone: '05551112233' },
      senderAddress: { fullName: 'Depo' },
    };
    prisma.$transaction.mockResolvedValue([[row], 1]);

    const result = await service.list(scope, {} as any);

    expect(result.items[0]).not.toHaveProperty('recipientAddress');
    expect(result.items[0]).not.toHaveProperty('senderAddress');
    // Decimal is serialised as a number, not as a Prisma object.
    expect(result.items[0].totalDesi).toBe(0.33);
  });
});
