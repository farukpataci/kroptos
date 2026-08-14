import { HttpStatus } from '@nestjs/common';
import { AmazonConnector } from './AmazonConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * Pins the LWA exchange, region routing, NextToken paging and the per-order
 * item lookup. NOT proof the endpoints exist; live verification against a real
 * seller account is outstanding.
 */
describe('AmazonConnector', () => {
  const CREDENTIALS = {
    sellerId: 'A1SELLER',
    clientId: 'amzn1.application-oa2-client.x',
    clientSecret: 'client-secret',
    refreshToken: 'Atzr|refresh',
  };
  const SETTINGS = { 'amazon.marketplaceIds': ['A1PA6795UKMFR9'] };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = SETTINGS, credentials = CREDENTIALS) =>
    new AmazonConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const calls = () => httpClient.request.mock.calls;
  const lastCall = () => calls()[calls().length - 1];

  /** Answers the LWA exchange first, then hands the rest to `then`. */
  const withToken = (then: (url: string) => unknown) => {
    httpClient.request.mockImplementation(async (url: string) => {
      if (url.includes('api.amazon.com/auth/o2/token')) {
        return { access_token: 'Atza|access', expires_in: 3600 };
      }
      return then(url);
    });
  };

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('login with amazon', () => {
    it('should exchange the refresh token as form data and reuse the result', async () => {
      withToken(() => ({ payload: { Orders: [] } }));

      const connector = build();
      await connector.testConnection();
      await connector.testConnection();

      const tokenCalls = calls().filter(([url]) => url.includes('/auth/o2/token'));
      // Two API calls, but the token is fetched once and cached on the instance.
      expect(tokenCalls).toHaveLength(1);

      const [, options] = tokenCalls[0];
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      const body = new URLSearchParams(options.body);
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('Atzr|refresh');
      expect(body.get('client_id')).toBe(CREDENTIALS.clientId);
      expect(body.get('client_secret')).toBe('client-secret');
    });

    it('should send the access token as x-amz-access-token on API calls', async () => {
      withToken(() => ({ payload: { Orders: [] } }));

      await build().testConnection();

      const apiCall = calls().find(([url]) => url.includes('sellingpartnerapi'));
      expect(apiCall?.[1].headers['x-amz-access-token']).toBe('Atza|access');
    });

    it('should blame the refresh token when the exchange is refused', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 400),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Refresh Token');
    });

    it('should fail before any call when the LWA client id is missing', async () => {
      const result = await build(SETTINGS, { ...CREDENTIALS, clientId: '' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('clientId');
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });

  describe('region and marketplace routing', () => {
    it('should call the region host chosen in settings', async () => {
      withToken(() => ({ payload: { Orders: [] } }));

      await build({ ...SETTINGS, 'amazon.region': 'na' }).testConnection();

      expect(calls().some(([url]) => url.includes('https://sellingpartnerapi-na.amazon.com'))).toBe(true);
    });

    it('should use the sandbox host for the sandbox environment', async () => {
      withToken(() => ({ payload: { Orders: [] } }));

      await build({ ...SETTINGS, 'general.environment': 'sandbox' }).testConnection();

      expect(
        calls().some(([url]) => url.includes('https://sandbox.sellingpartnerapi-eu.amazon.com')),
      ).toBe(true);
    });

    it('should refuse to run without a marketplace id rather than guessing one', async () => {
      withToken(() => ({ payload: { Orders: [] } }));

      const result = await build({}).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('amazon.marketplaceIds');
    });
  });

  describe('getOrders', () => {
    const order = (id: string, status: string) => ({
      AmazonOrderId: id,
      OrderStatus: status,
      PurchaseDate: '2026-08-01T10:00:00Z',
      BuyerInfo: { BuyerName: 'Ada Lovelace', BuyerEmail: 'ada@example.com' },
      OrderTotal: { Amount: '80.00', CurrencyCode: 'EUR' },
    });

    it('should follow NextToken and drop the other parameters on the second page', async () => {
      withToken((url) => {
        if (url.includes('/orderItems')) return { payload: { OrderItems: [] } };
        if (url.includes('NextToken=cursor-1')) return { payload: { Orders: [order('A-2', 'Unshipped')] } };
        return { payload: { Orders: [order('A-1', 'Unshipped')], NextToken: 'cursor-1' } };
      });

      const orders = await build().getOrders();

      expect(orders.map((o) => o.orderNumber)).toEqual(['A-1', 'A-2']);
      const secondPage = calls().find(([url]) => url.includes('NextToken=cursor-1'));
      expect(secondPage?.[0]).not.toContain('CreatedAfter');
    });

    it('should fetch line items per order because the order payload omits them', async () => {
      withToken((url) => {
        if (url.includes('/orderItems')) {
          return {
            payload: {
              OrderItems: [
                {
                  ASIN: 'B001',
                  SellerSKU: 'SKU-1',
                  Title: 'Ürün',
                  QuantityOrdered: 2,
                  ItemPrice: { Amount: '40.00', CurrencyCode: 'EUR' },
                },
              ],
            },
          };
        }
        return { payload: { Orders: [order('A-1', 'Unshipped')] } };
      });

      const [unified] = await build().getOrders();

      expect(calls().some(([url]) => url.includes('/orders/v0/orders/A-1/orderItems'))).toBe(true);
      expect(unified.items).toEqual([
        { sku: 'SKU-1', name: 'Ürün', quantity: 2, unitPrice: 40, totalPrice: 80 },
      ]);
    });

    it('should filter by status before spending an item call on each order', async () => {
      withToken((url) => {
        if (url.includes('/orderItems')) return { payload: { OrderItems: [] } };
        return { payload: { Orders: [order('A-1', 'Unshipped'), order('A-2', 'Canceled')] } };
      });

      const orders = await build({ ...SETTINGS, 'orders.importStatuses': ['created'] }).getOrders();

      expect(orders.map((o) => o.orderNumber)).toEqual(['A-1']);
      const itemCalls = calls().filter(([url]) => url.includes('/orderItems'));
      expect(itemCalls).toHaveLength(1);
    });
  });

  describe('updateStock', () => {
    it('should PATCH the listing with a fulfillment availability replacement', async () => {
      withToken(() => ({}));

      const result = await build().updateStock('SKU-1', 9);

      expect(result).toEqual({ sku: 'SKU-1', quantity: 9, success: true });
      const [url, options] = lastCall();
      expect(url).toContain('/listings/2021-08-01/items/A1SELLER/SKU-1');
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body).patches[0]).toMatchObject({
        op: 'replace',
        path: '/attributes/fulfillment_availability',
        value: [{ fulfillment_channel_code: 'DEFAULT', quantity: 9 }],
      });
    });
  });

  describe('categories', () => {
    it('should map Amazon product types onto the category surface', async () => {
      withToken(() => ({ productTypes: [{ name: 'SHIRT' }] }));

      await expect(build().getCategories()).resolves.toEqual([{ name: 'SHIRT' }]);
    });
  });
});
