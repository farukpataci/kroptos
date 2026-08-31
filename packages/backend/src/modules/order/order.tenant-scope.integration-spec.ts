import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { OrderService } from './order.service';

/**
 * Tenant scoping on `OrderService.get`, against the real database.
 *
 * The finding this pins was not a data leak — the old code never returned
 * another tenant's row. It leaked the *existence* of one: the order was read
 * unscoped and `order.storeId !== activeStoreId` was checked afterwards, so a
 * real id belonging to someone else answered 403 while an invented id answered
 * 404. Anyone holding a token could sort real order ids from made-up ones by
 * the status code alone.
 *
 * A mocked Prisma cannot close this. With a mock, "the where clause is scoped"
 * is something the test asserts about a call it also wrote; here two tenants
 * genuinely exist in the same table and the database decides what comes back.
 * That is CLAUDE.md §7: the query's *shape* is exactly what a mock will agree
 * with while being wrong.
 *
 * The service is exercised directly rather than over HTTP. What changed is the
 * where clause and the exception it produces, both of which live here; the
 * guard chain in front of it was not touched, so putting a socket in the middle
 * would widen the blast radius of the test without widening the proof.
 *
 * Needs the live Postgres from packages/backend/.env. Fails rather than skips
 * when it is unreachable: a proof that quietly does not run is not a proof.
 */
describe('OrderService.get tenant scope, against the real database', () => {
  loadEnv({ path: join(__dirname, '../../../.env') });

  const prisma = new PrismaService();
  const service = new OrderService(prisma);
  const suffix = `its${Date.now()}`;

  /** Row counts taken before any fixture exists, re-checked after cleanup. */
  const COUNTED = ['agency', 'store', 'order'] as const;
  type Counted = (typeof COUNTED)[number];
  const countAll = async (): Promise<Record<Counted, number>> => ({
    agency: await prisma.agency.count(),
    store: await prisma.store.count(),
    order: await prisma.order.count(),
  });
  let before: Record<Counted, number>;

  const made = { agencyIds: [] as string[], storeIds: [] as string[], orderIds: [] as string[] };

  /** One agency with one store and one order in it. */
  const makeTenant = async (label: string) => {
    const agency = await prisma.agency.create({
      data: { name: `${label} ${suffix}`, slug: `${label}-${suffix}` },
    });
    made.agencyIds.push(agency.id);

    const store = await prisma.store.create({
      data: { agencyId: agency.id, name: `${label} store ${suffix}`, slug: `${label}-st-${suffix}` },
    });
    made.storeIds.push(store.id);

    const order = await prisma.order.create({
      data: {
        agencyId: agency.id,
        storeId: store.id,
        orderNumber: `ORD-${suffix}-${label}`,
        publicId: `ord_${suffix}_${label}`,
        customerName: `${label} buyer`,
        totalAmount: 100,
        currency: 'TRY',
        createdBy: 'integration-test',
      },
    });
    made.orderIds.push(order.id);

    return { agency, store, order };
  };

  let a: Awaited<ReturnType<typeof makeTenant>>;
  let b: Awaited<ReturnType<typeof makeTenant>>;

  beforeAll(async () => {
    before = await countAll();
    a = await makeTenant('a');
    b = await makeTenant('b');
  }, 60000);

  afterAll(async () => {
    try {
      await prisma.order.deleteMany({ where: { id: { in: made.orderIds } } });
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
      await prisma.$disconnect();
    }
  }, 60000);

  /** Tenant A's context, as the controller would hand it over. */
  const asA = () => [a.agency.id, undefined, a.store.id, false] as const;

  it('reads its own order by id', async () => {
    const found = await service.get(a.order.id, ...asA());
    expect(found.id).toBe(a.order.id);
  });

  it('reads its own order by publicId', async () => {
    const found = await service.get(a.order.publicId!, ...asA());
    expect(found.id).toBe(a.order.id);
  });

  /**
   * The finding itself. 404, not 403: the two answers have to be
   * indistinguishable, or the status code confirms that the id is real.
   */
  it("answers 404 for another tenant's order id, never 403", async () => {
    await expect(service.get(b.order.id, ...asA())).rejects.toBeInstanceOf(NotFoundException);
  });

  /**
   * The publicId branch separately, because the tempting shape of this fix —
   * `OR: [{ id, agencyId }, { publicId: id }]` — scopes only the first branch
   * and would pass the test above while leaking here, and leaking the row
   * itself rather than just its existence.
   */
  it("answers 404 for another tenant's publicId, never 403", async () => {
    await expect(service.get(b.order.publicId!, ...asA())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers 404 the same way for an id nobody owns', async () => {
    await expect(service.get(`ord_${suffix}_nobody`, ...asA())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('still lets a super admin across tenants', async () => {
    const found = await service.get(b.order.id, undefined, undefined, undefined, true);
    expect(found.id).toBe(b.order.id);
  });

  it('still refuses a non-super-admin with no store context', async () => {
    await expect(
      service.get(a.order.id, a.agency.id, undefined, undefined, false),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
