import { FarmazonConnector } from './FarmazonConnector';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * Pins the signin exchange, the envelope handling, the status vocabulary and
 * the barcode → listing id resolution stock updates depend on. NOT proof the
 * endpoints exist: nothing here has been run against a real Farmazon account.
 */
describe('FarmazonConnector', () => {
  const CREDENTIALS = {
    username: 'ecz1',
    password: 'pw',
    clientName: 'kroptos',
    clientSecretKey: 'sk',
  };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new FarmazonConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const calls = () => httpClient.request.mock.calls;

  const withToken = (then: (url: string, options: any) => unknown) => {
    httpClient.request.mockImplementation(async (url: string, options: any) => {
      if (url.includes('/account/signin')) {
        return { statusCode: 200, statusMessage: 'OK', result: { token: 'jwt-1' }, errors: null };
      }
      return then(url, options);
    });
  };

  const envelope = (result: unknown) => ({ statusCode: 200, statusMessage: 'OK', result, errors: null });

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('signin', () => {
    it('should post form-encoded credentials with the API_ user agent and cache the token', async () => {
      withToken(() => envelope({ items: [], totalPageCount: 1 }));

      const connector = build();
      await connector.testConnection();
      await connector.testConnection();

      const signins = calls().filter(([url]) => url.includes('/account/signin'));
      // Cached: the second testConnection re-signs in on purpose (it probes the
      // credentials), so two calls — never four.
      expect(signins).toHaveLength(2);

      const [url, options] = signins[0];
      expect(url).toBe('https://lab.farmazon.com.tr/api/v1/account/signin');
      expect(options.headers['User-Agent']).toBe('API_ecz1');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      const body = new URLSearchParams(options.body);
      expect(body.get('username')).toBe('ecz1');
      expect(body.get('clientSecretKey')).toBe('sk');
    });

    it('should send the token as a bearer on API calls', async () => {
      withToken(() => envelope({ items: [] }));

      await build().testConnection();

      const apiCall = calls().find(([url]) => url.includes('/listings/getlistings'));
      expect(apiCall?.[1].headers.Authorization).toBe('Bearer jwt-1');
      expect(apiCall?.[1].headers['User-Agent']).toBe('API_ecz1');
    });

    it('should use the staging host when the environment is sandbox', async () => {
      withToken(() => envelope({ items: [] }));

      await build({ 'general.environment': 'sandbox' }).testConnection();

      expect(calls()[0][0]).toBe('https://staging.lab.farmazon.com.tr/api/v1/account/signin');
    });

    it('should fail the probe when the response carries no token', async () => {
      httpClient.request.mockResolvedValue(envelope({}));

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('token');
    });
  });

  describe('envelope', () => {
    // Farmazon answers HTTP 200 and refuses inside the body; a connector that
    // only checks the transport reads a refusal as an empty catalogue.
    it('should throw when the envelope reports a failing status code', async () => {
      withToken(() => ({ statusCode: 422, statusMessage: 'VALIDATION ERROR', result: null }));

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('422');
    });
  });

  describe('getOrders', () => {
    const order = (orderStateId: number, orderId = '1001') => ({
      orderId,
      orderStateId,
      orderPrice: 250,
      buyerId: 77,
      shipmentCompany: 'Aras',
      shipmentFollowUpNo: 12345,
      orderDetails: [{ barcode: '869000000001', productName: 'Parol', quantity: 2, price: 125 }],
    });

    it('should filter by the settings status vocabulary, not the Kroptos one', async () => {
      // 1 = created, 4 = shipped. The default selection is created/picking/shipped,
      // so folding to 'pending' here would drop the row the seller asked for.
      withToken(() => envelope([order(1, 'A'), order(64, 'B')]));

      const orders = await build({ 'orders.importStatuses': ['created', 'picking', 'shipped'] }).getOrders();

      expect(orders.map((o) => o.orderNumber)).toEqual(['A']);
      expect(orders[0].status).toBe('pending');
      expect(orders[0].source).toBe('farmazon');
    });

    it('should ask Farmazon for a single state when exactly one is selected', async () => {
      withToken(() => envelope([]));

      await build({ 'orders.importStatuses': ['shipped'] }).getOrders();

      const url = new URL(calls().find(([u]) => u.includes('getsoldorders'))![0]);
      expect(url.searchParams.get('orderState')).toBe('4');
      expect(url.searchParams.get('startDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should apply the prefix and the seller status map', async () => {
      withToken(() => envelope([order(4)]));

      const orders = await build({
        'orders.importStatuses': [],
        'orders.numberPrefix': 'FRM-',
        'orders.statusMap': { shipped: 'processing' },
      }).getOrders();

      expect(orders[0].orderNumber).toBe('FRM-1001');
      expect(orders[0].status).toBe('processing');
    });

    it('should carry the carrier details Farmazon already knows', async () => {
      withToken(() => envelope([order(4)]));

      const orders = await build({ 'orders.importStatuses': [] }).getOrders();

      expect(orders[0].shipping).toEqual({ carrierName: 'Aras', trackingNumber: '12345' });
      expect(orders[0].items[0]).toMatchObject({ sku: '869000000001', quantity: 2, totalPrice: 250 });
    });
  });

  describe('updateStock', () => {
    const listingPage = {
      page: 1,
      pageSize: 50,
      totalPageCount: 1,
      items: [
        { id: 9, price: 10, stock: 3, product: { barcode: '869000000001', name: 'Parol' } },
        { id: 10, price: 20, stock: 1, product: { barcode: '869000000002', name: 'Aspirin' } },
      ],
    };

    it('should resolve the barcode to a listing id before sending stock', async () => {
      withToken((url) =>
        url.includes('UpdateListingsStockOnly')
          ? { statusCode: 207, result: [{ success: true, errors: [] }] }
          : envelope(listingPage),
      );

      const result = await build().updateStock('SKU-1', 42, { barcode: '869000000002' });

      expect(result.success).toBe(true);
      const [url, options] = calls().find(([u]) => u.includes('UpdateListingsStockOnly'))!;
      expect(url).toBe('https://lab.farmazon.com.tr/api/v2/listings/UpdateListingsStockOnly');
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual([{ id: '10', stock: 42, isActive: true }]);
    });

    it('should report a failure rather than a silent success when nothing matches', async () => {
      withToken(() => envelope(listingPage));

      const result = await build().updateStock('SKU-9', 5, { barcode: 'yok' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('listing bulunamadı');
    });

    it('should surface a rejected row from the multi-status body', async () => {
      withToken((url) =>
        url.includes('UpdateListingsStockOnly')
          ? { statusCode: 207, result: [{ success: false, errors: [{ message: 'stok negatif' }] }] }
          : envelope(listingPage),
      );

      const result = await build().updateStock('SKU-1', -1, { barcode: '869000000001' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('stok negatif');
    });
  });

  describe('mode', () => {
    it('should default to simulation until a live account confirms the endpoints', () => {
      expect(build().connectionMode).toEqual({ mode: 'simulation', source: 'default' });
    });

    it('should refuse category reads instead of returning an empty list', async () => {
      await expect(build().getCategories()).rejects.toThrow(/doğrulanmadı/);
    });
  });
});
