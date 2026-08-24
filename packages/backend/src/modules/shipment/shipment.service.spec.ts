import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@common/prisma/prisma.service';
import { ShipmentService } from './shipment.service';
import { OrderService } from '../order/order.service';
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
        // Only the delivery transition reaches it; the branches below never do.
        { provide: OrderService, useValue: { updateStatus: jest.fn() } },
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
    // Only cancelled attempts are counted. Counting live ones made the suffix
    // depend on timing, and two concurrent calls then wrote two different
    // reference codes — two barcodes for one order.
    expect(prisma.shipment.count.mock.calls[0][0].where).toMatchObject({
      orderId: 'ord-7',
      status: 'cancelled',
    });
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

  it('carries the connection test flag onto the shipment row', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);
    carriers.findOneOrFail.mockResolvedValue({ ...integration, isTestMode: true });

    await service.create(dto(), scope);

    // The column defaults to false so an unset flag reads as a real shipment;
    // the default is the net, not the decision. This pins the decision: the
    // value is written explicitly, from the connection.
    expect(prisma.shipment.create.mock.calls[0][0].data.isTestMode).toBe(true);
  });

  it('marks a shipment from a live connection as live', async () => {
    prisma.shipment.findFirst.mockResolvedValue(null);
    carriers.findOneOrFail.mockResolvedValue({ ...integration, isTestMode: false });

    await service.create(dto(), scope);

    expect(prisma.shipment.create.mock.calls[0][0].data.isTestMode).toBe(false);
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
        // Only the delivery transition reaches it; the branches below never do.
        { provide: OrderService, useValue: { updateStatus: jest.fn() } },
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
        // Only the delivery transition reaches it; the branches below never do.
        { provide: OrderService, useValue: { updateStatus: jest.fn() } },
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
      // refresh answers with the detail projection, which reads both relations.
      packages: [],
      events: [],
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
  // The relations are here because refresh answers with the detail projection.
  const shipment = {
    id: 'shp-1',
    trackingNumber: 'TRK-1',
    carrierIntegrationId: 'ci-1',
    deliveredAt: null,
    packages: [],
    events: [],
  };

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
        // Only the delivery transition reaches it; the branches below never do.
        { provide: OrderService, useValue: { updateStatus: jest.fn() } },
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

/**
 * The detail payload and the cancel branches. Both are places where the quiet
 * failure is the expensive one: an address handed to everyone who can read a
 * shipment, and a barcode left live at the carrier because nobody asked.
 */
describe('ShipmentService - detail projection and cancel branches', () => {
  let service: ShipmentService;

  const cancelShipment = jest.fn();
  const findByReference = jest.fn();
  const integration = { id: 'ci-1', provider: 'YURTICI', isTestMode: true, settings: {} };

  const prisma: any = {
    shipment: { findFirst: jest.fn(), update: jest.fn() },
    shipmentTrackingEvent: { create: jest.fn() },
  };
  const carriers: any = { findOneOrFail: jest.fn(), connectorFor: jest.fn() };
  const scope = { agencyId: 'ag-1', storeId: 'st-1', clientId: null } as any;

  const claim = (over: any = {}) => ({
    id: 'shp-1',
    publicId: 'shp_1',
    provider: 'YURTICI',
    status: 'created',
    trackingNumber: null,
    referenceCode: 'ord-7',
    carrierIntegrationId: 'ci-1',
    carrierCancelledAt: null,
    ...over,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: CarrierIntegrationService, useValue: carriers },
        // Only the delivery transition reaches it; the branches below never do.
        { provide: OrderService, useValue: { updateStatus: jest.fn() } },
      ],
    }).compile();

    service = module.get(ShipmentService);
    jest.clearAllMocks();

    prisma.shipment.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'shp-1', ...data }),
    );
    prisma.shipmentTrackingEvent.create.mockResolvedValue({});
    carriers.findOneOrFail.mockResolvedValue(integration);
    carriers.connectorFor.mockReturnValue({ cancelShipment, findByReference });
    cancelShipment.mockResolvedValue({ success: true });
    findByReference.mockResolvedValue(null);
  });

  it('keeps addresses out of the detail payload but keeps the timeline', async () => {
    prisma.shipment.findFirst.mockResolvedValue({
      ...claim({ status: 'in_transit', trackingNumber: 'TRK-1' }),
      totalDesi: new Prisma.Decimal('0.33'),
      senderAddress: { fullName: 'Depo' },
      recipientAddress: { fullName: 'Ada', phone: '05551112233', line1: 'Bahce sok. 3' },
      packages: [
        {
          id: 'pkg-1',
          barcode: null,
          weightKg: new Prisma.Decimal('1'),
          lengthCm: new Prisma.Decimal('10'),
          widthCm: new Prisma.Decimal('10'),
          heightCm: new Prisma.Decimal('10'),
          desi: new Prisma.Decimal('0.33'),
          chargeableWeightKg: new Prisma.Decimal('1'),
          contentDescription: 'Tekstil',
        },
      ],
      events: [
        {
          id: 'ev-1',
          status: 'in_transit',
          carrierStatusCode: 'YK_TRANSFER',
          description: 'Transfer merkezinde',
          location: 'Istanbul',
          occurredAt: new Date('2026-08-24T09:00:00Z'),
          agencyId: 'ag-1',
          shipmentId: 'shp-1',
        },
      ],
    });

    const detail: any = await service.get('shp-1', scope);

    expect(detail).not.toHaveProperty('recipientAddress');
    expect(detail).not.toHaveProperty('senderAddress');
    expect(detail.events).toHaveLength(1);
    expect(detail.events[0]).toMatchObject({
      status: 'in_transit',
      carrierStatusCode: 'YK_TRANSFER',
    });
    // The nested rows are projected too, not spread wholesale.
    expect(detail.events[0]).not.toHaveProperty('agencyId');
    expect(detail.packages[0].desi).toBe(0.33);
    expect(JSON.stringify(detail)).not.toContain('05551112233');
  });

  it('asks the carrier by reference when the claim has no tracking number', async () => {
    prisma.shipment.findFirst.mockResolvedValue(claim());

    const result = await service.cancel('shp-1', scope, {} as any);

    expect(findByReference).toHaveBeenCalledWith('ord-7');
    // Nothing came back, so there is no barcode to void.
    expect(cancelShipment).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.carrierCancelled).toBe(false);
    const data = prisma.shipment.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: 'cancelled',
      carrierCancelledAt: null,
      carrierCancelError: null,
    });
    expect(data.cancelledAt).toBeInstanceOf(Date);
  });

  it('voids the barcode the reference lookup turned up, and records it', async () => {
    prisma.shipment.findFirst.mockResolvedValue(claim());
    findByReference.mockResolvedValue({ trackingNumber: 'TRK-RECOVERED' });

    const result = await service.cancel('shp-1', scope, {} as any);

    expect(cancelShipment).toHaveBeenCalledWith('TRK-RECOVERED');
    expect(result.carrierCancelled).toBe(true);
    const data = prisma.shipment.update.mock.calls[0][0].data;
    // The barcode existed after all; the row must stop claiming otherwise.
    expect(data.trackingNumber).toBe('TRK-RECOVERED');
    expect(data.carrierCancelledAt).toBeInstanceOf(Date);
  });

  it('still cancels when the reference lookup fails, and writes the doubt down', async () => {
    prisma.shipment.findFirst.mockResolvedValue(claim());
    findByReference.mockRejectedValue(new Error('carrier 503'));

    const result = await service.cancel('shp-1', scope, {} as any);

    expect(result.success).toBe(true);
    expect(cancelShipment).not.toHaveBeenCalled();
    const data = prisma.shipment.update.mock.calls[0][0].data;
    expect(data.status).toBe('cancelled');
    // carrierCancelError filled + carrierCancelledAt empty = chase this by hand.
    expect(data.carrierCancelError).toContain('carrier 503');
    expect(data.carrierCancelledAt).toBeNull();
  });

  it('closes our side without touching a carrier that cannot look up by reference', async () => {
    prisma.shipment.findFirst.mockResolvedValue(claim());
    carriers.connectorFor.mockReturnValue({ cancelShipment }); // no findByReference

    const result = await service.cancel('shp-1', scope, {} as any);

    expect(cancelShipment).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(prisma.shipment.update.mock.calls[0][0].data.status).toBe('cancelled');
  });
});

/**
 * The body both bulk endpoints and the WMS label go through.
 *
 * These assertions used to live in the WMS label spec, because that is where
 * the code was. They moved with it: the address rules and the store the
 * shipment lands in are properties of this path now, and testing them where
 * they are is what keeps a second copy from growing back.
 */
describe('ShipmentService.createForOrder — one order in, one shipment out', () => {
  let service: ShipmentService;

  const prisma: any = {
    order: { findFirst: jest.fn() },
    shipment: { findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const createShipment = jest.fn();
  const carriers: any = {
    resolveCarrierIntegration: jest.fn(),
    findOneOrFail: jest.fn(),
    connectorFor: jest.fn(() => ({ createShipment })),
  };
  const orders: any = { updateStatus: jest.fn() };

  const parcel = { weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 };
  const dto = (over: any = {}) => ({ orderId: 'ord-1', parcels: [parcel], ...over });

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: CarrierIntegrationService, useValue: carriers },
        { provide: OrderService, useValue: orders },
      ],
    }).compile();

    service = module.get(ShipmentService);
    jest.clearAllMocks();

    prisma.order.findFirst.mockResolvedValue(order);
    prisma.shipment.findFirst.mockResolvedValue(null);
    prisma.shipment.count.mockResolvedValue(0);
    prisma.shipment.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'shp-1', ...data }),
    );
    prisma.shipment.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'shp-1', ...data }),
    );
    carriers.resolveCarrierIntegration.mockResolvedValue({
      id: 'ci-1',
      provider: 'YURTICI',
      displayName: 'Yurtici Kargo',
      isActive: true,
      isTestMode: true,
      settings: {},
      senderAddress: { fullName: 'Depo', city: 'Istanbul' },
    });
    carriers.findOneOrFail.mockResolvedValue({
      id: 'ci-1',
      provider: 'YURTICI',
      displayName: 'Yurtici Kargo',
      isActive: true,
      isTestMode: true,
      settings: {},
      senderAddress: { fullName: 'Depo', city: 'Istanbul' },
    });
    createShipment.mockResolvedValue({ trackingNumber: 'TRK-1', barcode: 'BC-1' });
  });

  it("creates the shipment in the order's own store, not the request's", async () => {
    await service.createForOrder('ag-1', dto() as any);

    // A packer at agency level must not have to switch stores between two
    // parcels on the same bench.
    expect(prisma.shipment.create.mock.calls[0][0].data).toMatchObject({
      agencyId: 'ag-1',
      storeId: 'st-1',
      clientId: null,
    });
  });

  it('reads the address off the order and never from the caller', async () => {
    await service.createForOrder('ag-1', dto() as any);

    const request = createShipment.mock.calls[0][0];
    expect(request.recipient).toMatchObject({
      // Falls back to the buyer: an order with no separate recipient is
      // delivered to whoever placed it. Nothing else falls back.
      fullName: 'Ada Yilmaz',
      phone: '05551112233',
      district: 'Kadikoy',
      city: 'Istanbul',
    });
  });

  it('names the missing address fields instead of shipping to half an address', async () => {
    prisma.order.findFirst.mockResolvedValue({
      ...order,
      shippingDistrict: null,
      shippingCity: '   ',
    });

    const error = await service.createForOrder('ag-1', dto() as any).catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toMatchObject({
      code: 'INCOMPLETE_SHIPPING_ADDRESS',
      missingFields: ['shippingDistrict', 'shippingCity'],
    });
    expect(createShipment).not.toHaveBeenCalled();
  });

  it('requires the amount when the parcel is paid on delivery', async () => {
    const error = await service
      .createForOrder('ag-1', dto({ paymentType: 'cod' }) as any)
      .catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(createShipment).not.toHaveBeenCalled();
  });

  it("takes the order's currency for a cash-on-delivery parcel", async () => {
    await service.createForOrder('ag-1', dto({ paymentType: 'cod', codAmount: 250 }) as any);

    expect(prisma.shipment.create.mock.calls[0][0].data).toMatchObject({
      paymentType: 'cod',
      codAmount: 250,
      codCurrency: 'TRY',
    });
  });

  it('refuses an order outside the agency', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(service.createForOrder('ag-1', dto() as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(createShipment).not.toHaveBeenCalled();
  });

  it('lets the carrier refusal through untouched', async () => {
    carriers.resolveCarrierIntegration.mockRejectedValue(
      new BadRequestException({ code: 'NO_ACTIVE_CARRIER' }),
    );

    const error = await service.createForOrder('ag-1', dto() as any).catch((e) => e);

    expect(error.getResponse()).toMatchObject({ code: 'NO_ACTIVE_CARRIER' });
    expect(prisma.shipment.create).not.toHaveBeenCalled();
  });

  it('keeps going after a failed order and reports it by id', async () => {
    prisma.order.findFirst
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, id: 'ord-2', shippingCity: null });

    const result = await service.createForOrders('ag-1', [
      dto(),
      dto({ orderId: 'ord-2' }),
    ] as any);

    // A rollback cannot un-buy the first barcode, so the round does not stop.
    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[1]).toMatchObject({
      orderId: 'ord-2',
      success: false,
      error: { code: 'INCOMPLETE_SHIPPING_ADDRESS' },
    });
  });
});
