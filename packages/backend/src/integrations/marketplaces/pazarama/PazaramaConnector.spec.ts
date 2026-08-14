import { HttpStatus } from '@nestjs/common';
import { PazaramaConnector } from './PazaramaConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * Pins the client-credentials exchange, the data envelope handling and the
 * status folding. NOT proof the endpoints exist; live verification against a
 * real seller account is outstanding.
 */
describe('PazaramaConnector', () => {
  const CREDENTIALS = { apiKey: 'pzr-key', secretKey: 'pzr-secret' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new PazaramaConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const calls = () => httpClient.request.mock.calls;
  const lastCall = () => calls()[calls().length - 1];

  const withToken = (then: (url: string) => unknown) => {
    httpClient.request.mockImplementation(async (url: string) => {
      if (url.includes('/connect/token')) {
        return { data: { accessToken: 'tok-1', expiresIn: 3600 } };
      }
      return then(url);
    });
  };

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('token exchange', () => {
    it('should request a client-credentials token with Basic auth and cache it', async () => {
      withToken(() => ({ data: { items: [], totalCount: 5 } }));

      const connector = build();
      await connector.testConnection();
      await connector.testConnection();

      const tokenCalls = calls().filter(([url]) => url.includes('/connect/token'));
      expect(tokenCalls).toHaveLength(1);

      const [url, options] = tokenCalls[0];
      expect(url).toBe('https://isortagimgiris.pazarama.com/connect/token');
      expect(options.headers.Authorization).toBe(
        `Basic ${Buffer.from('pzr-key:pzr-secret').toString('base64')}`,
      );
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      const body = new URLSearchParams(options.body);
      expect(body.get('grant_type')).toBe('client_credentials');
      expect(body.get('scope')).toBe('merchantgatewayapi.fullaccess');
    });

    it('should send the token as a bearer on merchant API calls', async () => {
      withToken(() => ({ data: { items: [] } }));

      await build().testConnection();

      const apiCall = calls().find(([url]) => url.includes('isortagimapi'));
      expect(apiCall?.[1].headers.Authorization).toBe('Bearer tok-1');
    });

    it('should blame the key pair when the exchange is refused', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 401),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Secret Key');
    });

    it('should name the missing credential before calling anything', async () => {
      const result = await build({}, { apiKey: 'k', secretKey: '' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('secretKey');
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });

  describe('envelope handling', () => {
    it('should read rows from a nested data.items envelope', async () => {
      withToken(() => ({
        data: { items: [{ code: 'SKU-1', name: 'Ürün', salePrice: 20, stockCount: 3 }], totalCount: 1 },
      }));

      const products = await build().getProducts();

      expect(products).toEqual([
        { sku: 'SKU-1', name: 'Ürün', description: undefined, price: 20, stockQuantity: 3, image: undefined, barcode: undefined },
      ]);
    });

    it('should read rows from a flat data array too', async () => {
      withToken(() => ({ data: [{ code: 'SKU-2', name: 'Ürün 2', salePrice: 5, stockCount: 1 }] }));

      const products = await build().getProducts();

      expect(products.map((p) => p.sku)).toEqual(['SKU-2']);
    });
  });

  describe('orders', () => {
    const order = (orderNumber: string, status: string) => ({
      id: 1,
      orderNumber,
      status,
      customerName: 'Ada Lovelace',
      totalPrice: 40,
      shippingAddress: { address: 'Sokak 1', city: 'İstanbul', district: 'Beşiktaş' },
      items: [{ stockCode: 'SKU-1', productName: 'Ürün', quantity: 2, price: 20 }],
    });

    it('should post the date window and map the order', async () => {
      withToken(() => ({ data: { items: [order('PZR-1', 'New')] } }));

      const [unified] = await build({ 'orders.backfillDays': 5 }).getOrders();

      const apiCall = calls().find(([url]) => url.includes('/order/getOrdersForApi'));
      const body = JSON.parse(apiCall![1].body);
      expect(Math.abs(new Date(body.startDate).getTime() - (Date.now() - 5 * 86400000))).toBeLessThan(10_000);

      expect(unified).toMatchObject({
        orderNumber: 'PZR-1',
        customerName: 'Ada Lovelace',
        status: 'pending',
        source: 'pazarama',
      });
      expect(unified.items).toEqual([
        { sku: 'SKU-1', name: 'Ürün', quantity: 2, unitPrice: 20, totalPrice: 40 },
      ]);
    });

    it('should fold marketplace status names onto the settings vocabulary', async () => {
      withToken(() => ({
        data: { items: [order('PZR-1', 'Preparing'), order('PZR-2', 'Cancelled')] },
      }));

      const orders = await build({ 'orders.importStatuses': ['picking'] }).getOrders();

      expect(orders.map((o) => o.orderNumber)).toEqual(['PZR-1']);
    });
  });

  describe('updateStock', () => {
    it('should post the stock code and count', async () => {
      withToken(() => ({}));

      const result = await build().updateStock('SKU-7', 4);

      expect(result).toEqual({ sku: 'SKU-7', quantity: 4, success: true });
      expect(lastCall()[0]).toContain('/product/updateStock');
      expect(JSON.parse(lastCall()[1].body)).toEqual({ items: [{ code: 'SKU-7', stockCount: 4 }] });
    });
  });
});
