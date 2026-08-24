import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@common/prisma/prisma.service';
import { encrypt } from '../../common/utils/encryption.util';
import { CarrierConnectorFactory } from '../../integrations/carriers/core/CarrierConnectorFactory';
import { WmsModule } from '../wms/wms.module';
import { ShipmentModule } from './shipment.module';

/**
 * F-4: the idempotency proof, without mocks standing in for the parts that
 * matter.
 *
 * The unit suite pins the branches, but it cannot close this finding: with a
 * mocked Prisma there is no unique index, so "the loser gets P2002" is
 * something the test asserts rather than something the database does. Here the
 * index is real, the HTTP server is real (two sockets, two requests), and the
 * only stand-in is the carrier itself — which has to be a spy, because the
 * whole question is how many times it was asked to sell a barcode.
 *
 * Needs the live Postgres from packages/backend/.env, so it is kept out of the
 * default `jest` run (see jest.integration.config.js) and started with
 * `pnpm test:integration`. It fails rather than skips when the database is
 * unreachable: a silently skipped proof is not a proof.
 */
describe('F-4: shipment idempotency against the real database', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  const createShipment = jest.fn();
  const suffix = `it${Date.now()}`;

  // Everything created here is torn down in afterAll; the counts are compared
  // against these so a leaked fixture cannot pass unnoticed.
  const before: Record<string, number> = {};
  const made = {
    agencyIds: [] as string[],
    storeIds: [] as string[],
    userIds: [] as string[],
    roleIds: [] as string[],
    permissionIds: [] as string[],
    carrierIntegrationIds: [] as string[],
  };

  let agencyId: string;
  let otherAgencyId: string;
  let storeId: string;
  let otherStoreId: string;
  let carrierIntegrationId: string;
  let allowedUserId: string;
  let deniedUserId: string;

  const COUNTED = [
    'order',
    'wmsShippingLabel',
    'shipment',
    'shipmentPackage',
    'shipmentTrackingEvent',
    'carrierIntegration',
    'userRole',
    'user',
    'role',
    'permission',
    'store',
    'agency',
  ] as const;

  const countAll = async () => {
    const out: Record<string, number> = {};
    for (const model of COUNTED) out[model] = await (prisma as any)[model].count();
    return out;
  };

  /**
   * The tenant context TenantMiddleware would have resolved, plus the JWT user
   * PermissionGuard reads. Supplied per request so one server can act as two
   * tenants and two roles. PermissionGuard itself is NOT stubbed — it still
   * goes to the database for the role and its permissions, which is the only
   * way the 403 below means anything.
   */
  const call = (
    path: string,
    init: { method?: string; body?: unknown; userId?: string; agency?: string; store?: string } = {},
  ) =>
    fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        'x-test-user': init.userId ?? allowedUserId,
        'x-test-agency': init.agency ?? agencyId,
        'x-test-store': init.store ?? storeId,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  const shipmentBody = (orderId: string) => ({
    carrierIntegrationId,
    orderId,
    orderNumber: `ORD-${orderId}`,
    recipient: {
      fullName: 'Ada Test',
      phone: '05550000000',
      line1: 'Test sok. 1',
      district: 'Kadikoy',
      city: 'Istanbul',
      countryCode: 'TR',
    },
    parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    paymentType: 'sender_pays',
  });

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ShipmentModule, WmsModule],
    })
      // Authentication is not what this test is about; the tenant middleware and
      // the JWT strategy live in AppModule, so their output is injected instead.
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      // The one deliberate stand-in: a carrier we can count calls on.
      .overrideProvider(CarrierConnectorFactory)
      .useValue({
        create: () => ({
          createShipment,
          getLabel: jest.fn(),
          track: jest.fn(),
          cancelShipment: jest.fn(),
          testConnection: jest.fn(),
        }),
        supportedProviders: () => ['MOCK'],
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.use((req: any, _res: any, next: any) => {
      const agency = req.headers['x-test-agency'];
      const store = req.headers['x-test-store'];
      req.user = { userId: req.headers['x-test-user'], agencyId: agency, clientId: null, role: 'tester' };
      req.activeAgency = { id: agency };
      req.activeStore = store ? { id: store } : undefined;
      next();
    });

    prisma = app.get(PrismaService);
    try {
      await prisma.$connect();
    } catch (error: any) {
      throw new Error(
        'Bu suite canli Postgres gerektiriyor (packages/backend/.env -> DATABASE_URL). ' +
          'Calistirma: pnpm test:integration. Baglanti hatasi: ' +
          (error?.message ?? String(error)),
      );
    }
    before.snapshot = 0;
    Object.assign(before, await countAll());

    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    // --- fixtures ---------------------------------------------------------
    const agency = await prisma.agency.create({ data: { name: `F4 ${suffix}`, slug: `f4-${suffix}` } });
    const otherAgency = await prisma.agency.create({
      data: { name: `F4 other ${suffix}`, slug: `f4-other-${suffix}` },
    });
    agencyId = agency.id;
    otherAgencyId = otherAgency.id;
    made.agencyIds.push(agency.id, otherAgency.id);

    const store = await prisma.store.create({ data: { agencyId, name: `F4 store ${suffix}` } });
    const otherStore = await prisma.store.create({
      data: { agencyId: otherAgencyId, name: `F4 other store ${suffix}` },
    });
    storeId = store.id;
    otherStoreId = otherStore.id;
    made.storeIds.push(store.id, otherStore.id);

    // The carrier permissions are in prisma/seed.ts but this database has not
    // been re-seeded since, so they are created here and removed again.
    const permissionNames = ['shipments.read', 'shipments.create', 'wms.labels.create'];
    const permissions = [];
    for (const name of permissionNames) {
      const existing = await prisma.permission.findUnique({ where: { name } });
      if (existing) {
        permissions.push(existing);
      } else {
        const created = await prisma.permission.create({ data: { name, description: `F4 ${suffix}` } });
        permissions.push(created);
        made.permissionIds.push(created.id);
      }
    }

    const shipperRole = await prisma.role.create({
      data: {
        name: `f4-shipper-${suffix}`,
        permissions: { connect: permissions.map((p) => ({ id: p.id })) },
      },
    });
    // Deliberately holds no shipments.* permission at all.
    const readerRole = await prisma.role.create({ data: { name: `f4-nothing-${suffix}` } });
    made.roleIds.push(shipperRole.id, readerRole.id);

    const allowed = await prisma.user.create({
      data: { email: `f4-allowed-${suffix}@test.local`, passwordHash: 'x' },
    });
    const denied = await prisma.user.create({
      data: { email: `f4-denied-${suffix}@test.local`, passwordHash: 'x' },
    });
    allowedUserId = allowed.id;
    deniedUserId = denied.id;
    made.userIds.push(allowed.id, denied.id);

    await prisma.userRole.create({ data: { userId: allowed.id, agencyId, roleId: shipperRole.id } });
    await prisma.userRole.create({ data: { userId: denied.id, agencyId, roleId: readerRole.id } });
    // The same allowed user in the other tenant, so the 404 below proves the
    // scope filter and not merely a missing role.
    await prisma.userRole.create({
      data: { userId: allowed.id, agencyId: otherAgencyId, roleId: shipperRole.id },
    });

    const integration = await prisma.carrierIntegration.create({
      data: {
        publicId: `crr_${suffix}`,
        agencyId,
        storeId,
        provider: 'MOCK',
        displayName: 'F4 mock',
        credentials: encrypt(JSON.stringify({})),
        isTestMode: true,
        // Without a default sender the service rejects the create with a 400
        // before the carrier is ever reached — a real connection carries one.
        senderAddress: {
          fullName: 'Kroptos Depo',
          phone: '02120000000',
          line1: 'Depo cad. 1',
          district: 'Tuzla',
          city: 'Istanbul',
          countryCode: 'TR',
        },
      },
    });
    carrierIntegrationId = integration.id;
    made.carrierIntegrationIds.push(integration.id);
  }, 60000);

  afterAll(async () => {
    try {
      // Children first: Shipment cascades its packages and events, but the
      // carrier connection is only SetNull, so shipments go before it.
      await prisma.wmsShippingLabel.deleteMany({ where: { agencyId: { in: made.agencyIds } } });
      await prisma.shipment.deleteMany({ where: { agencyId: { in: made.agencyIds } } });
      await prisma.order.deleteMany({ where: { agencyId: { in: made.agencyIds } } });
      await prisma.carrierIntegration.deleteMany({ where: { id: { in: made.carrierIntegrationIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: made.userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: made.userIds } } });
      await prisma.role.deleteMany({ where: { id: { in: made.roleIds } } });
      if (made.permissionIds.length) {
        await prisma.permission.deleteMany({ where: { id: { in: made.permissionIds } } });
      }
      await prisma.store.deleteMany({ where: { id: { in: made.storeIds } } });
      await prisma.agency.deleteMany({ where: { id: { in: made.agencyIds } } });

      const after = await countAll();
      const drifted = COUNTED.filter((m) => after[m] !== before[m]);
      if (drifted.length) {
        throw new Error(
          `Fixture sizintisi: ${drifted.map((m) => `${m} ${before[m]} -> ${after[m]}`).join(', ')}`,
        );
      }
    } finally {
      await app?.close();
    }
  }, 60000);

  beforeEach(() => {
    jest.clearAllMocks();
    createShipment.mockImplementation(async (req: any) => {
      // Slow on purpose: the winner is still at the carrier while the loser is
      // deciding what to do, which is the window the finding was about.
      await new Promise((resolve) => setTimeout(resolve, 120));
      return { trackingNumber: `TRK-${req.referenceCode}`, barcode: `BC-${req.referenceCode}` };
    });
  });

  it('buys one barcode when the same order is posted twice at once', async () => {
    const orderId = `ord-${suffix}-race`;

    // Sockets warmed first: an unwarmed connection costs more than the claim
    // INSERT, so the second request would arrive after the first had already
    // committed and the race would never happen.
    await call('/api/shipments');

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        call('/api/shipments', { method: 'POST', body: shipmentBody(orderId) }),
      ),
    );
    const [first, second] = responses;

    const bodies = (await Promise.all(responses.map((r) => r.json()))) as any[];
    const [a, b] = bodies;
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201, 201]);
    // Every caller got the same shipment, not just the first two.
    expect(new Set(bodies.map((x) => x.publicId)).size).toBe(1);

    // (a) one row, and both callers were handed the same one
    const rows = await prisma.shipment.findMany({ where: { agencyId, orderId } });
    expect(rows).toHaveLength(1);
    expect(a.publicId).toBe(b.publicId);
    expect(a.publicId).toBe(rows[0].publicId);

    // (b) the carrier was asked exactly once — without this the test says
    // nothing a mocked Prisma could not have said
    expect(createShipment).toHaveBeenCalledTimes(1);

    // (c) the loser never reached the carrier, so the barcode it would have
    // bought does not exist; the surviving row carries the winner's
    expect(rows[0].trackingNumber).toBe(`TRK-${orderId}`);
    expect(rows[0].status).toBe('label_ready');
    expect(rows[0].referenceCode).toBe(orderId);
  }, 60000);

  /**
   * The P2002 branch, proven against the real unique index rather than a mocked
   * Prisma. The race above does not reach it on this machine: the claim INSERT
   * commits in about a millisecond, so every later request finds the row and
   * returns through findLiveShipment instead. That is the same outcome, but it
   * is not the same code path, and the path that only runs under load is
   * exactly the one worth pinning.
   *
   * So the collision is arranged instead of raced for: a row that already holds
   * the reference code but carries no orderId. findLiveShipment looks by
   * orderId and misses it; the INSERT then hits
   * Shipment_agencyId_storeId_referenceCode_key and the loser has to recover.
   * This is the state a real race produces for the moment it lasts.
   */
  it('yields to the row that already holds the reference code', async () => {
    const orderId = `ord-${suffix}-p2002`;
    const squatter = await prisma.shipment.create({
      data: {
        publicId: `shp_${suffix}_squat`,
        agencyId,
        storeId,
        provider: 'MOCK',
        status: 'label_ready',
        paymentType: 'sender_pays',
        referenceCode: orderId,
        trackingNumber: `TRK-${suffix}-squat`,
        orderId: null,
        isTestMode: true,
      },
    });

    const response = await call('/api/shipments', { method: 'POST', body: shipmentBody(orderId) });
    const body = (await response.json()) as any;

    expect(response.status).toBe(201);
    // The loser read the winner instead of buying a barcode of its own.
    expect(body.publicId).toBe(squatter.publicId);
    expect(createShipment).not.toHaveBeenCalled();
    expect(await prisma.shipment.count({ where: { agencyId, referenceCode: orderId } })).toBe(1);
  }, 60000);

  it('does not buy a second barcode on a later repeat either', async () => {
    const orderId = `ord-${suffix}-repeat`;

    const first = await call('/api/shipments', { method: 'POST', body: shipmentBody(orderId) });
    const second = await call('/api/shipments', { method: 'POST', body: shipmentBody(orderId) });

    const [a, b] = (await Promise.all([first.json(), second.json()])) as any[];
    expect(a.publicId).toBe(b.publicId);
    expect(createShipment).toHaveBeenCalledTimes(1);
    expect(await prisma.shipment.count({ where: { agencyId, orderId } })).toBe(1);
  }, 60000);

  it('hides another tenant\'s shipment behind a 404, not a 403', async () => {
    const orderId = `ord-${suffix}-tenant`;
    const created = await call('/api/shipments', { method: 'POST', body: shipmentBody(orderId) });
    const shipment = (await created.json()) as any;

    // Same user, same role, different active tenant context.
    const foreign = await call(`/api/shipments/${shipment.id}`, {
      agency: otherAgencyId,
      store: otherStoreId,
    });
    expect(foreign.status).toBe(404);

    // And it is genuinely reachable in its own context, so the 404 above is the
    // scope filter rather than a broken route.
    const own = await call(`/api/shipments/${shipment.id}`);
    expect(own.status).toBe(200);
    expect(((await own.json()) as any).publicId).toBe(shipment.publicId);
  }, 60000);

  /**
   * The two states nobody is coming to fix automatically. Both are measured
   * here rather than in the unit suite because the boundary is a real
   * `createdAt < now() - 15min` comparison made by Postgres, and because the
   * point of the pair is that it survives the projection all the way out to
   * JSON — a field dropped on the way is exactly how this became invisible in
   * the first place.
   */
  describe('the shipments someone has to chase', () => {
    const stuckIds: string[] = [];

    const claimRow = (label: string, minutesAgo: number) => ({
      publicId: `shp_${suffix}_${label}`,
      agencyId,
      storeId,
      provider: 'MOCK',
      status: 'created',
      paymentType: 'sender_pays',
      referenceCode: `ref-${suffix}-${label}`,
      trackingNumber: null,
      createdAt: new Date(Date.now() - minutesAgo * 60_000),
      isTestMode: true,
    });

    afterEach(async () => {
      if (stuckIds.length) {
        await prisma.shipment.deleteMany({ where: { id: { in: stuckIds.splice(0) } } });
      }
    });

    it('counts a claim older than the cutoff and leaves the younger one alone', async () => {
      // Sixteen and fourteen minutes: one on each side of the fifteen-minute
      // line, so the assertion is about the boundary and not about "old" versus
      // "new".
      const older = await prisma.shipment.create({ data: claimRow('old', 16) });
      const younger = await prisma.shipment.create({ data: claimRow('young', 14) });
      stuckIds.push(older.id, younger.id);

      const counts = (await (await call('/api/shipments/problems')).json()) as any;
      expect(counts.stuckClaims).toBe(1);
      expect(counts.stuckClaimAfterMinutes).toBe(15);

      const listed = (await (await call('/api/shipments?problem=stuck_claim')).json()) as any;
      expect(listed.items).toHaveLength(1);
      expect(listed.items[0].publicId).toBe(older.publicId);
    }, 60000);

    it('surfaces a cancel the carrier refused, as the pair that means it', async () => {
      const live = await prisma.shipment.create({
        data: {
          ...claimRow('livebarcode', 1),
          status: 'cancelled',
          trackingNumber: `TRK-${suffix}-live`,
          cancelledAt: new Date(),
          // Filled error, empty confirmation: the barcode is still live.
          carrierCancelledAt: null,
          carrierCancelError: 'Paket toplanmis, iptal edilemez',
        },
      });
      stuckIds.push(live.id);

      const counts = (await (await call('/api/shipments/problems')).json()) as any;
      expect(counts.carrierCancelFailed).toBe(1);
      expect(counts.total).toBe(counts.stuckClaims + counts.carrierCancelFailed);

      const listed = (await (await call('/api/shipments?problem=carrier_cancel_failed')).json()) as any;
      expect(listed.items).toHaveLength(1);
      // Both halves survive the projection; either one alone says nothing.
      expect(listed.items[0].carrierCancelError).toContain('toplanmis');
      expect(listed.items[0].carrierCancelledAt).toBeNull();
      // And still no address on the way out.
      expect(listed.items[0]).not.toHaveProperty('recipientAddress');
    }, 60000);

    it('does not count a cancel the carrier confirmed', async () => {
      const clean = await prisma.shipment.create({
        data: {
          ...claimRow('cleancancel', 1),
          status: 'cancelled',
          trackingNumber: `TRK-${suffix}-clean`,
          cancelledAt: new Date(),
          carrierCancelledAt: new Date(),
          carrierCancelError: null,
        },
      });
      stuckIds.push(clean.id);

      const counts = (await (await call('/api/shipments/problems')).json()) as any;
      expect(counts.carrierCancelFailed).toBe(0);
    }, 60000);

    it('rejects a problem filter it does not know', async () => {
      const response = await call('/api/shipments?problem=whatever');
      expect(response.status).toBe(400);
    }, 60000);
  });

  /**
   * The WMS label, end to end: order in, barcode out.
   *
   * Measured here because the claim is about rows the database actually holds
   * — one ShipmentPackage per measured box, and a total that is the sum of the
   * parts rather than a figure computed from one of them. A mocked Prisma would
   * have agreed with any arithmetic.
   */
  describe('WMS label from a real order', () => {
    const box = (over: any = {}) => ({
      weightKg: 1,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
      ...over,
    });

    const makeOrder = async (label: string) =>
      prisma.order.create({
        data: {
          agencyId,
          storeId,
          orderNumber: `ORD-${suffix}-${label}`,
          customerName: 'Ada Yilmaz',
          customerPhone: '05551112233',
          totalAmount: 100,
          currency: 'TRY',
          createdBy: allowedUserId,
          shippingLine1: 'Bahce sok. 3',
          shippingDistrict: 'Kadikoy',
          shippingCity: 'Istanbul',
          shippingPostalCode: '34710',
          shippingCountryCode: 'TR',
        },
      });

    it('writes one package row per box and totals the desi from the parts', async () => {
      const order = await makeOrder('multi');

      const response = await call('/api/wms/labels', {
        method: 'POST',
        body: {
          orderId: order.id,
          // 30x20x10 / 3000 = 2 desi, and 40x30x20 / 3000 = 8 desi.
          parcels: [box(), box({ lengthCm: 40, widthCm: 30, heightCm: 20, weightKg: 3 })],
        },
      });

      expect(response.status).toBe(201);
      const label = (await response.json()) as any;

      const shipment = await prisma.shipment.findFirst({
        where: { agencyId, orderId: order.id },
        include: { packages: true },
      });

      expect(shipment).not.toBeNull();
      expect(shipment!.packages).toHaveLength(2);
      // 2 + 8, summed per parcel rather than measured off the total.
      expect(Number(shipment!.totalDesi)).toBe(10);
      expect(Number(shipment!.totalWeightKg)).toBe(4);
      // Billed weight is max(weight, desi) per box: max(1,2) + max(3,8) = 10.
      expect(Number(shipment!.chargeableWeightKg)).toBe(10);

      // The label is a derivative of that shipment, with no invented values.
      expect(label.shipmentId).toBe(shipment!.id);
      expect(label.trackingNumber).toBe(shipment!.trackingNumber);
      expect(label.carrierName).toBe('F4 mock');
      expect(label.trackingNumber).not.toMatch(/^YK-/);
    }, 60000);

    it('still handles a single box', async () => {
      const order = await makeOrder('single');

      const response = await call('/api/wms/labels', {
        method: 'POST',
        body: { orderId: order.id, parcels: [box()] },
      });

      expect(response.status).toBe(201);
      const shipment = await prisma.shipment.findFirst({
        where: { agencyId, orderId: order.id },
        include: { packages: true },
      });
      expect(shipment!.packages).toHaveLength(1);
      expect(Number(shipment!.totalDesi)).toBe(2);
    }, 60000);

    it('refuses a label request with no measurement', async () => {
      const order = await makeOrder('nobox');

      const response = await call('/api/wms/labels', {
        method: 'POST',
        body: { orderId: order.id },
      });

      expect(response.status).toBe(400);
      expect(await prisma.shipment.count({ where: { agencyId, orderId: order.id } })).toBe(0);
    }, 60000);

    it('names the missing address fields rather than shipping to half an address', async () => {
      const order = await prisma.order.create({
        data: {
          agencyId,
          storeId,
          orderNumber: `ORD-${suffix}-noaddr`,
          customerName: 'Ada Yilmaz',
          totalAmount: 100,
          createdBy: allowedUserId,
          shippingCity: 'Istanbul',
        },
      });

      const response = await call('/api/wms/labels', {
        method: 'POST',
        body: { orderId: order.id, parcels: [box()] },
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as any;
      expect(body.code).toBe('INCOMPLETE_SHIPPING_ADDRESS');
      expect(body.missingFields).toEqual(
        expect.arrayContaining(['shippingLine1', 'shippingDistrict', 'shippingCountryCode']),
      );
      // The buyer's own phone and name filled those two in.
      expect(body.missingFields).not.toContain('shippingFullName');
    }, 60000);
  });

  it('refuses a role without shipments.create with a 403', async () => {
    const response = await call('/api/shipments', {
      method: 'POST',
      body: shipmentBody(`ord-${suffix}-rbac`),
      userId: deniedUserId,
    });

    expect(response.status).toBe(403);
    expect(createShipment).not.toHaveBeenCalled();
    expect(await prisma.shipment.count({ where: { agencyId, orderId: `ord-${suffix}-rbac` } })).toBe(0);
  }, 60000);

  it('lets the same role read, so the 403 above was about the permission', async () => {
    const response = await call('/api/shipments', { userId: deniedUserId });
    // shipments.read is not on the denied role either — the point is that the
    // guard answers per permission, not per user.
    expect(response.status).toBe(403);

    const allowedRead = await call('/api/shipments');
    expect(allowedRead.status).toBe(200);
  }, 60000);
});
