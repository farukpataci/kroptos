import { IntegrationSyncWorker } from './integration-sync.worker';
import { N11Connector } from '../../integrations/marketplaces/n11/N11Connector';
import { MarketplaceHttpClient } from '../../integrations/marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../integrations/marketplaces/core/MarketplaceRateLimiter';

/**
 * The isolation guarantee, held by a test rather than by reviewer memory.
 *
 * A connector in simulation mode serves invented orders and products. If the
 * worker persisted them, the seller's tables would hold rows that no query
 * downstream could tell from real ones — and the alternative design (a stored
 * `isSimulated` flag plus a default filter on every list query) leaks the moment
 * one query forgets the filter. So the rule is that nothing is written at all,
 * and this file fails if that ever stops being true.
 */
describe('IntegrationSyncWorker — simulation isolation', () => {
  const INTEGRATION = {
    id: 'int-1',
    agencyId: 'agency-1',
    clientId: 'client-1',
    storeId: 'store-1',
    provider: 'n11',
    providerType: 'marketplace',
    credentialsEncrypted: 'encrypted',
    status: 'active',
  };

  let prisma: any;
  /** Any HTTP attempt at all is a failure of the mode gate, so it throws. */
  let httpClient: MarketplaceHttpClient;
  let worker: IntegrationSyncWorker;
  let settings: Record<string, unknown>;

  const runJob = (eventType: string, payload: any = {}) =>
    (worker as any).processJob({
      queueRecordId: 'queue-1',
      integrationId: INTEGRATION.id,
      eventType,
      payload,
    });

  beforeEach(() => {
    settings = {};

    prisma = {
      integrationQueue: { update: jest.fn().mockResolvedValue({}) },
      integration: {
        findUnique: jest.fn().mockResolvedValue(INTEGRATION),
        update: jest.fn().mockResolvedValue({}),
      },
      apiLog: { create: jest.fn().mockResolvedValue({}) },
      product: { upsert: jest.fn(), create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      order: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      store: { findUnique: jest.fn(), findFirst: jest.fn() },
      client: { findFirst: jest.fn() },
    };

    httpClient = {
      request: jest.fn(() => {
        throw new Error('simülasyon modunda dış çağrı yapıldı');
      }),
    } as unknown as MarketplaceHttpClient;

    const connectorFactory = {
      create: (provider: string, credentials: Record<string, any>, resolved: Record<string, unknown>) =>
        new N11Connector(credentials, httpClient, new MarketplaceRateLimiter(), resolved),
    };

    worker = new IntegrationSyncWorker(
      prisma,
      { get: () => undefined } as any,
      {
        decrypt: () => ({ apiKey: 'k', apiSecret: 's' }),
        validate: () => undefined,
        persistRotatedCredentials: jest.fn(),
      } as any,
      connectorFactory as any,
      { create: jest.fn() } as any,
      { resolveForRuntime: async () => settings } as any,
    );
  });

  /** What the log line ends up saying, read back from the ApiLog write. */
  const loggedMessage = () => JSON.parse(prisma.apiLog.create.mock.calls[0][0].data.responseBody).message;

  describe('simulation mode (n11 default)', () => {
    it('should write no product rows', async () => {
      await runJob('sync_products');

      expect(prisma.product.upsert).not.toHaveBeenCalled();
      expect(prisma.product.create).not.toHaveBeenCalled();
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('should write no order rows', async () => {
      await runJob('sync_orders');

      expect(prisma.order.create).not.toHaveBeenCalled();
      // Not even the placeholder products an order import would otherwise create.
      expect(prisma.product.create).not.toHaveBeenCalled();
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('should push no stock to the marketplace', async () => {
      await runJob('sync_stock', { sku: 'SIM-SKU-1', quantity: 10 });

      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('should say in the log that it was simulated, and where the mode came from', async () => {
      await runJob('sync_orders');

      expect(loggedMessage()).toContain('[simulation:default]');
      expect(loggedMessage()).toContain('yazılmadı');
    });

    it('should still count what a real run would have produced', async () => {
      await runJob('sync_orders');

      // The sample set holds two orders; the count proves the rows were read and
      // deliberately dropped rather than never fetched.
      expect(loggedMessage()).toMatch(/2 örnek sipariş/);
    });

    it('should report the job as processed, not failed', async () => {
      await runJob('sync_products');

      expect(prisma.integrationQueue.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'processed' }) }),
      );
    });

    it('should keep the mode when the environment selects simulation for everyone', async () => {
      process.env.MARKETPLACE_MODE = 'simulation';
      try {
        await runJob('sync_orders');
        expect(loggedMessage()).toContain('[simulation:env]');
      } finally {
        delete process.env.MARKETPLACE_MODE;
      }
    });
  });

  describe('live mode', () => {
    beforeEach(() => {
      settings = { 'general.mode': 'live' };
    });

    it('should never fall back to sample rows when the marketplace call fails', async () => {
      // Live mode now calls the real n11 endpoints, and this http client throws.
      // The point being pinned is what happens next: the job fails, and nothing
      // invented is written in place of the orders that did not arrive.
      await runJob('sync_orders');

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(prisma.product.create).not.toHaveBeenCalled();
      expect(prisma.integrationQueue.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
      );
      expect(prisma.apiLog.create.mock.calls[0][0].data.errorMessage).toContain('n11');
    });

    it('should mark the integration as errored so the UI stops claiming success', async () => {
      await runJob('sync_products');

      expect(prisma.integration.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'error' }) }),
      );
    });
  });
});
