import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { PrismaService } from '@common/prisma/prisma.service';
import { IntegrationSyncWorker } from '../../../modules/integration/integration-sync.worker';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { TrendyolConnector } from './TrendyolConnector';

/**
 * 14.2's acceptance: run a provider's read for real and see the keys it drops.
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
describe('14.2: unmapped keys from a live Trendyol read', () => {
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

    // The cargo block this whole step is about: Trendyol sends it, the mapper
    // does not read it. Measured on stage, 50/50 packages carried all three.
    expect(listed).toEqual(expect.arrayContaining(['cargoProviderName', 'cargoTrackingNumber']));

    // Names only. Every entry has to look like a key path — a value with a
    // space, a digit run, an @ or a + in it would fail here.
    for (const key of listed) {
      expect(key).toMatch(/^[A-Za-z0-9_]+(\[\]|\.[A-Za-z0-9_]+)*$/);
    }
    // And the payload is real, so these would be present if a value leaked.
    const dump = JSON.stringify(rows);
    expect(dump).not.toMatch(/\+90|@|Musteri/i);
  }, 120000);

  it('does not write the same finding again on the next round', async () => {
    const before = await prisma.integrationLog.count({ where: { tenantId } });

    const second = connector();
    await second.getOrders();
    await record(second);

    expect(await prisma.integrationLog.count({ where: { tenantId } })).toBe(before);
  }, 120000);
});
