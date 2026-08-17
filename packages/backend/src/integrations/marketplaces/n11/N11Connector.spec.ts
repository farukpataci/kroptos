import { N11Connector } from './N11Connector';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * The previous version of this file pinned four endpoints that do not exist —
 * every assertion passed against a mock while `testConnection` answered 404 in
 * production. So nothing here asserts an unverified URL.
 *
 * Only two paths were confirmed against the live gateway (2026-08-17):
 *   GET /cdn/categories
 *   GET /cdn/category/{id}/attribute
 * Everything else is asserted the other way round: that it refuses to call at
 * all rather than calling a path nobody has confirmed.
 */
describe('N11Connector', () => {
  const CREDENTIALS = { apiKey: 'app-key', apiSecret: 'app-secret' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };
  const originalEnvMode = process.env.MARKETPLACE_MODE;

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new N11Connector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  /** Live mode has to be asked for explicitly; the connector defaults away from it. */
  const live = (extra: Record<string, unknown> = {}) => build({ 'general.mode': 'live', ...extra });

  const lastCall = () => httpClient.request.mock.calls[httpClient.request.mock.calls.length - 1];

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
    delete process.env.MARKETPLACE_MODE;
  });

  afterAll(() => {
    if (originalEnvMode === undefined) delete process.env.MARKETPLACE_MODE;
    else process.env.MARKETPLACE_MODE = originalEnvMode;
  });

  // ------------------------------------------------------------ mode resolution

  describe('mode resolution', () => {
    it('should default to simulation, because no read endpoint is verified', () => {
      expect(build().connectionMode).toEqual({ mode: 'simulation', source: 'default' });
    });

    it('should let the environment override the connector default', () => {
      process.env.MARKETPLACE_MODE = 'live';

      expect(build().connectionMode).toEqual({ mode: 'live', source: 'env' });
    });

    it('should let the saved setting override the environment', () => {
      process.env.MARKETPLACE_MODE = 'live';

      expect(build({ 'general.mode': 'simulation' }).connectionMode).toEqual({
        mode: 'simulation',
        source: 'setting',
      });
    });

    it('should ignore an unrecognised value rather than guessing', () => {
      process.env.MARKETPLACE_MODE = 'nonsense';

      expect(build({ 'general.mode': 'auto' }).connectionMode).toEqual({
        mode: 'simulation',
        source: 'default',
      });
    });
  });

  // ----------------------------------------------------------------- simulation

  describe('simulation mode', () => {
    it('should test the connection without making any request', async () => {
      const result = await build().testConnection();

      expect(httpClient.request).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain('SİMÜLASYON');
      expect(result).toMatchObject({ mode: 'simulation', modeSource: 'default' });
    });

    it('should still refuse a blank credential, so a fake success cannot hide it', async () => {
      const result = await build({}, { apiKey: 'k', apiSecret: '' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('apiSecret');
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('should produce orders and products without any request, both stamped', async () => {
      const connector = build();

      const orders = await connector.getOrders();
      const products = await connector.getProducts();

      expect(httpClient.request).not.toHaveBeenCalled();
      expect(orders.length).toBeGreaterThan(0);
      expect(products.length).toBeGreaterThan(0);
      for (const payload of [...orders, ...products]) {
        expect(payload).toMatchObject({ mode: 'simulation', modeSource: 'default' });
      }
    });

    it('should mark a simulated order number so it cannot pass for a real one', async () => {
      const [order] = await build().getOrders();

      // Intrinsic to the sample data, not to a setting: a seller who clears
      // orders.numberPrefix must not thereby produce order numbers that look
      // like real ones.
      expect(order.orderNumber).toMatch(/^SIM-/);
    });

    it('should still apply the manifest order prefix on top of that mark', async () => {
      // 'N11-' is what n11.settings.ts defaults orders.numberPrefix to, and what
      // resolveForRuntime hands the connector in production.
      const [order] = await build({ 'orders.numberPrefix': 'N11-' }).getOrders();

      expect(order.orderNumber).toBe('N11-SIM-1001');
    });

    it('should report a stock update as simulated, without any request', async () => {
      const result = await build().updateStock('SIM-SKU-1', 7);

      expect(httpClient.request).not.toHaveBeenCalled();
      expect(result).toEqual({
        sku: 'SIM-SKU-1',
        quantity: 7,
        success: true,
        mode: 'simulation',
        modeSource: 'default',
      });
    });

    it('should serve categories and attributes without any request', async () => {
      const connector = build();

      expect((await connector.getCategories()).length).toBeGreaterThan(0);
      expect(await connector.getCategoryAttributes('1000')).toMatchObject({
        categoryId: '1000',
        mode: 'simulation',
      });
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------- live mode

  describe('live mode', () => {
    it('should read categories from the one confirmed path', async () => {
      httpClient.request.mockResolvedValue({ categories: [{ id: 1000, name: 'Kitap' }] });

      const categories = await live().getCategories();

      expect(categories).toHaveLength(1);
      const [url, options] = lastCall();
      expect(url).toBe('https://api.n11.com/cdn/categories');
      expect(options.method).toBe('GET');
      expect(options.headers.appKey).toBe('app-key');
      expect(options.headers.appSecret).toBe('app-secret');
      expect(options.headers.Authorization).toBeUndefined();
    });

    it('should accept a bare array of categories as well', async () => {
      httpClient.request.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      expect(await live().getCategories()).toHaveLength(2);
    });

    it('should read category attributes from the confirmed path', async () => {
      httpClient.request.mockResolvedValue({ attributes: [] });

      await live().getCategoryAttributes('42');

      expect(lastCall()[0]).toBe('https://api.n11.com/cdn/category/42/attribute');
    });

    it('should test the connection against the category endpoint', async () => {
      httpClient.request.mockResolvedValue({ categories: [{ id: 1 }, { id: 2 }] });

      const result = await live().testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('2 kayıt');
      expect(result).toMatchObject({ mode: 'live', modeSource: 'setting' });
      expect(lastCall()[0]).toBe('https://api.n11.com/cdn/categories');
    });

    it.each(['getOrders', 'getProducts'] as const)(
      'should refuse %s instead of calling an unverified endpoint',
      async (method) => {
        await expect(live()[method]()).rejects.toThrow(/canlı uç noktası doğrulanmadı/);
        expect(httpClient.request).not.toHaveBeenCalled();
      },
    );

    it('should name the refused operation, so a log says which one is missing', async () => {
      await expect(live().getOrders()).rejects.toThrow(/getOrders/);
    });

    it('should fail a stock update without throwing, and without calling anything', async () => {
      const result = await live().updateStock('SKU-9', 5);

      expect(httpClient.request).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('canlı uç noktası doğrulanmadı');
      expect(result).toMatchObject({ sku: 'SKU-9', quantity: 5, mode: 'live' });
    });

    it('should never fall back to sample data when live', async () => {
      const orders = await live().getOrders().catch(() => 'refused');

      expect(orders).toBe('refused');
    });
  });

  // ---------------------------------------------------------- the mode stamp

  /**
   * Every payload leaving a connector has to say which mode produced it. A
   * single unstamped return type is a hole: that is the one the worker or the UI
   * treats as real.
   */
  describe('mode stamp reaches every return type', () => {
    const expectStamp = (payload: any, mode: string, source: string) => {
      expect(payload.mode).toBe(mode);
      expect(payload.modeSource).toBe(source);
    };

    it('stamps all five in simulation', async () => {
      const connector = build();

      expectStamp(await connector.testConnection(), 'simulation', 'default');
      expectStamp((await connector.getOrders())[0], 'simulation', 'default');
      expectStamp((await connector.getProducts())[0], 'simulation', 'default');
      expectStamp(await connector.updateStock('SIM-SKU-1', 1), 'simulation', 'default');
      expectStamp(await connector.getCategoryAttributes('1000'), 'simulation', 'default');
    });

    it('stamps the failure paths in live too, source included', async () => {
      httpClient.request.mockRejectedValue(new Error('boom'));

      expectStamp(await live().testConnection(), 'live', 'setting');
      expectStamp(await live().updateStock('SKU-1', 1), 'live', 'setting');
    });

    it('reports the env as the source when it is what decided', async () => {
      process.env.MARKETPLACE_MODE = 'simulation';

      expectStamp(await build().testConnection(), 'simulation', 'env');
      expectStamp((await build().getOrders())[0], 'simulation', 'env');
    });
  });

  // ------------------------------------------------------- settings that apply

  describe('order settings', () => {
    it('should apply the seller status map over the connector mapping', async () => {
      const orders = await build({
        'orders.importStatuses': ['created'],
        'orders.statusMap': { created: 'processing' },
      }).getOrders();

      expect(orders).toHaveLength(1);
      expect(orders[0].status).toBe('processing');
    });

    it('should ignore a status map value outside the known set', async () => {
      const [order] = await build({
        'orders.importStatuses': ['created'],
        'orders.statusMap': { created: 'teslim-edildi' },
      }).getOrders();

      expect(order.status).toBe('pending');
    });

    it('should honour a custom order prefix', async () => {
      const [order] = await build({
        'orders.importStatuses': ['created'],
        'orders.numberPrefix': 'X-',
      }).getOrders();

      expect(order.orderNumber).toBe('X-SIM-1001');
    });

    it('should filter by the selected import statuses', async () => {
      const shippedOnly = await build({ 'orders.importStatuses': ['shipped'] }).getOrders();

      expect(shippedOnly).toHaveLength(1);
      expect(shippedOnly[0].status).toBe('shipped');
    });
  });

  // ------------------------------------------------------------- error mapping

  describe('error mapping', () => {
    it('should map a 429 onto the rate limit setting', async () => {
      const { MarketplaceHttpError } = jest.requireActual('../core/MarketplaceHttpClient');
      httpClient.request.mockRejectedValue(new MarketplaceHttpError('failed', 502, 429));

      const result = await live().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('advanced.rateLimitPerMinute');
      expect(result.mode).toBe('live');
    });

    it('should explain a gateway HTML page instead of pasting it', async () => {
      const { MarketplaceHttpError } = jest.requireActual('../core/MarketplaceHttpClient');
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', 502, 503, '<html><body>Application is not available</body></html>'),
      );

      const result = await live().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('HTML sayfası');
      expect(result.message).not.toContain('<html>');
    });
  });
});
