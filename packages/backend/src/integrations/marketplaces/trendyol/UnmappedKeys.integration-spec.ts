import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { PrismaService } from '@common/prisma/prisma.service';
import { IntegrationSyncWorker } from '../../../modules/integration/integration-sync.worker';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { TrendyolConnector } from './TrendyolConnector';

/**
 * Run a provider's read for real: see the keys it drops, and see the cargo
 * block filled from the same body. The two halves belong together — a mapping
 * that is added and a key that leaves the dropped list are one fact.
 *
 * Not a mocked payload. A mock would be written from the same reading of the
 * documentation as the narrow function, so the two would agree about a field
 * neither of them has — which is the exact failure this machinery exists to
 * catch. The body comes off Trendyol's stage gateway, and the log row is
 * written by the worker's own code into the live database.
 *
 * Needs TY_SELLER / TY_KEY / TY_SECRET in packages/backend/.env (stage seller)
 * and the live Postgres. Fails rather than skips when either is missing: a
 * proof that quietly does not run is not a proof.
 *
 * Read-only against Trendyol — one GET on the orders/shipment-packages list.
 */
describe('unmapped keys and the cargo block, from a live Trendyol read', () => {
  loadEnv({ path: join(__dirname, '../../../../.env') });

  const prisma = new PrismaService();
  const tenantId = `it-unmapped-${Date.now()}`;
  let logsBefore: number;

  const connector = () =>
    new TrendyolConnector(
      { sellerId: process.env.TY_SELLER, apiKey: process.env.TY_KEY, apiSecret: process.env.TY_SECRET },
      new MarketplaceHttpClient(),
      new MarketplaceRateLimiter(),
      {
        'general.environment': 'sandbox',
        'general.mode': 'live',
        // Every status, so the round is not empty because of a status filter.
        'orders.importStatuses': [],
        // Seven days, measured: the stage account's fixtures sit inside that
        // window and a 365-day range comes back empty.
        'orders.backfillDays': 7,
      },
    );

  // Only prisma is reached: onModuleInit is never called, so no Redis, no queue.
  const worker = new IntegrationSyncWorker(
    prisma,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
  );
  const record = (c: any) => (worker as any).recordUnmappedKeys(tenantId, 'TRENDYOL', c);

  beforeAll(async () => {
    for (const key of ['TY_SELLER', 'TY_KEY', 'TY_SECRET']) {
      if (!process.env[key]) throw new Error(`${key} yok; canlı okuma yapılamaz.`);
    }
    await prisma.$connect();
    logsBefore = await prisma.integrationLog.count();
  });

  afterAll(async () => {
    await prisma.integrationLog.deleteMany({ where: { tenantId } });
    const after = await prisma.integrationLog.count();
    // The row count has to come back to where it started, or a fixture leaked.
    expect(after).toBe(logsBefore);
    await prisma.$disconnect();
  });

  it('writes the dropped key names, and only the names, as a warning', async () => {
    const live = connector();
    const orders = await live.getOrders();
    if (orders.length === 0) {
      throw new Error(
        'Stage hesabından son 7 günde sipariş gelmedi; bu testin ölçecek bir gövdesi yok.',
      );
    }

    await record(live);

    const rows = await prisma.integrationLog.findMany({ where: { tenantId } });
    expect(rows.length).toBeGreaterThan(0);

    const orderRows = rows.filter((row) => row.operation === 'orders.unmapped_keys');
    expect(orderRows.length).toBeGreaterThan(0);
    expect(orderRows[0].severity).toBe('warning');
    expect(orderRows[0].provider).toBe('TRENDYOL');

    const listed = orderRows.flatMap((row) => (row.errorMessage ?? '').split(': ')[1].split(', '));

    // Fields Trendyol sends and nothing reads. Both measured present on every
    // package, so their absence here would mean the recorder had stopped
    // working rather than that the payload had changed.
    expect(listed).toEqual(expect.arrayContaining(['agreedDeliveryDate', 'lines[].vatRate']));

    // And the other half of the loop: the cargo keys used to be on this list,
    // 14.3 mapped them, so they must be off it. This is what stops the mapping
    // from being quietly reverted.
    expect(listed).not.toContain('cargoProviderName');
    expect(listed).not.toContain('cargoTrackingNumber');
    expect(listed).not.toContain('cargoTrackingLink');
    expect(listed).not.toContain('packageHistories');

    // Names only. Every entry has to look like a key path — a value with a
    // space, a digit run, an @ or a + in it would fail here.
    for (const key of listed) {
      expect(key).toMatch(/^[A-Za-z0-9_]+(\[\]|\.[A-Za-z0-9_]+)*$/);
    }
    // And the payload is real, so these would be present if a value leaked.
    const dump = JSON.stringify(rows);
    expect(dump).not.toMatch(/\+90|@|Musteri/i);
  }, 120000);

  it('fills the shipping block from what the live payload carried', async () => {
    const orders = await connector().getOrders();

    const withParcel = orders.filter((order) => order.shipping !== undefined);
    if (withParcel.length === 0) {
      throw new Error('Stage hesabından kargo bilgisi olan paket gelmedi; ölçecek bir şey yok.');
    }

    for (const order of withParcel) {
      // Every measured package had a carrier name, so the block is never just
      // an empty shell.
      expect(typeof order.shipping!.carrierName).toBe('string');
      expect(order.shipping!.carrierName!.length).toBeGreaterThan(0);

      if (order.shipping!.trackingNumber !== undefined) {
        // A string, and never the "0" the gateway sends for "no barcode yet".
        expect(typeof order.shipping!.trackingNumber).toBe('string');
        expect(order.shipping!.trackingNumber).not.toBe('0');
      }
      if (order.shipping!.shippedAt !== undefined) {
        expect(order.shipping!.shippedAt).toBeInstanceOf(Date);
        expect(Number.isFinite(order.shipping!.shippedAt!.getTime())).toBe(true);
      }
    }

    // shippedAt only on parcels that actually left. Measured on stage: the 57
    // packages with a Shipped history are exactly the shipped/delivered/
    // collection-point/returned ones, and nothing earlier than that carries it.
    const stillHere = orders.filter((order) => ['pending', 'processing'].includes(order.status));
    for (const order of stillHere) {
      expect(order.shipping?.shippedAt).toBeUndefined();
    }
  }, 120000);

  it('does not write the same finding again on the next round', async () => {
    const before = await prisma.integrationLog.count({ where: { tenantId } });

    const second = connector();
    await second.getOrders();
    await record(second);

    expect(await prisma.integrationLog.count({ where: { tenantId } })).toBe(before);
  }, 120000);
});
