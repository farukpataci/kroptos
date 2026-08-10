import { HttpStatus } from '@nestjs/common';
import { EtsyConnector } from './EtsyConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * Pins the refresh grant, the dual auth headers, money scaling and the
 * read-modify-write inventory update. NOT proof the endpoints exist; live
 * verification against a real shop is outstanding.
 */
describe('EtsyConnector', () => {
  const CREDENTIALS = { keystring: 'etsy-key', refreshToken: 'refresh-1', shopId: '12345' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new EtsyConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const calls = () => httpClient.request.mock.calls;
  const lastCall = () => calls()[calls().length - 1];

  const withToken = (then: (url: string, options: any) => unknown) => {
    httpClient.request.mockImplementation(async (url: string, options: any) => {
      if (url.includes('/public/oauth/token')) {
        return { access_token: 'access-1', refresh_token: 'refresh-2', expires_in: 3600 };
      }
      return then(url, options);
    });
  };

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('authentication', () => {
    it('should exchange the pasted refresh token and cache the access token', async () => {
      withToken(() => ({ shop_name: 'Atolye', listing_active_count: 12 }));

      const connector = build();
      await connector.testConnection();
      await connector.testConnection();

      const tokenCalls = calls().filter(([url]) => url.includes('/public/oauth/token'));
      expect(tokenCalls).toHaveLength(1);

      const body = new URLSearchParams(tokenCalls[0][1].body);
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('client_id')).toBe('etsy-key');
      expect(body.get('refresh_token')).toBe('refresh-1');
    });

    it('should send both the app key and the bearer token', async () => {
      withToken(() => ({ shop_name: 'Atolye' }));

      await build().testConnection();

      const apiCall = calls().find(([url]) => url.includes('openapi.etsy.com'));
      expect(apiCall?.[1].headers['x-api-key']).toBe('etsy-key');
      expect(apiCall?.[1].headers.Authorization).toBe('Bearer access-1');
    });

    it('should tell the seller to re-paste when the refresh grant is refused', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 400),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Refresh Token');
    });

    it('should refuse before calling when the shop id is missing', async () => {
      const result = await build({}, { ...CREDENTIALS, shopId: '' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('shopId');
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });

  describe('orders', () => {
    const receipt = (id: number, status: string, shipped: boolean) => ({
      receipt_id: id,
      name: 'Ada Lovelace',
      buyer_email: 'ada@example.com',
      first_line: '1 Main St',
      city: 'London',
      country_iso: 'GB',
      status,
      is_shipped: shipped,
      grandtotal: { amount: 2599, divisor: 100, currency_code: 'GBP' },
      transactions: [
        { sku: 'SKU-1', title: 'El yapımı kupa', quantity: 1, price: { amount: 2599, divisor: 100, currency_code: 'GBP' } },
      ],
    });

    it('should scale integer money by its divisor', async () => {
      withToken(() => ({ results: [receipt(1, 'paid', false)], count: 1 }));

      const [unified] = await build().getOrders();

      expect(unified.totalAmount).toBe(25.99);
      expect(unified.currency).toBe('GBP');
      expect(unified.items[0]).toEqual({
        sku: 'SKU-1',
        name: 'El yapımı kupa',
        quantity: 1,
        unitPrice: 25.99,
        totalPrice: 25.99,
      });
    });

    it('should filter receipts by min_created in unix seconds', async () => {
      withToken(() => ({ results: [], count: 0 }));

      await build({ 'orders.backfillDays': 3 }).getOrders();

      const url = new URL(lastCall()[0]);
      const minCreated = Number(url.searchParams.get('min_created'));
      const expected = Math.floor((Date.now() - 3 * 86400000) / 1000);
      expect(Math.abs(minCreated - expected)).toBeLessThan(10);
    });

    it('should treat the shipped flag as fulfilment, not payment', async () => {
      withToken(() => ({
        results: [receipt(1, 'paid', true), receipt(2, 'paid', false)],
        count: 2,
      }));

      const orders = await build({ 'orders.importStatuses': ['shipped'] }).getOrders();

      expect(orders.map((o) => o.orderNumber)).toEqual(['1']);
      expect(orders[0].status).toBe('shipped');
    });
  });

  describe('updateStock', () => {
    const listingsPage = {
      count: 1,
      results: [{ listing_id: 999, skus: ['SKU-1'], title: 'Kupa', quantity: 3, price: { amount: 100, divisor: 100 } }],
    };

    it('should locate the listing by SKU and rewrite only the matching offerings', async () => {
      withToken((url, options) => {
        if (url.includes('/listings/999/inventory') && options.method !== 'PUT') {
          return {
            products: [
              { sku: 'SKU-1', offerings: [{ offering_id: 1, quantity: 3, price: 1 }] },
              { sku: 'SKU-OTHER', offerings: [{ offering_id: 2, quantity: 8, price: 1 }] },
            ],
          };
        }
        if (url.includes('/shops/12345/listings')) return listingsPage;
        return {};
      });

      const result = await build().updateStock('SKU-1', 11);

      expect(result).toEqual({ sku: 'SKU-1', quantity: 11, success: true });
      const put = calls().find(([, options]) => options.method === 'PUT');
      const body = JSON.parse(put![1].body);
      expect(body.products[0].offerings[0].quantity).toBe(11);
      // The untouched product keeps its own stock: this is a whole-document PUT.
      expect(body.products[1].offerings[0].quantity).toBe(8);
    });

    it('should report a clear failure when no listing carries the SKU', async () => {
      withToken(() => ({ count: 0, results: [] }));

      const result = await build().updateStock('SKU-MISSING', 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SKU-MISSING');
    });
  });
});
