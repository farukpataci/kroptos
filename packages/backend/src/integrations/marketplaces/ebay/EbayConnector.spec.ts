import { HttpStatus } from '@nestjs/common';
import { EbayConnector } from './EbayConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * These pin the request shape, the OAuth exchange and the marketplace scoping.
 * They are NOT proof the endpoints exist or that the marketplace ids are right:
 * a mock answers whatever it is told. Live verification against a real eBay
 * seller account is still outstanding.
 */
describe('EbayConnector', () => {
  const CREDENTIALS = {
    marketplace: 'EBAY_US',
    clientId: 'app-id',
    clientSecret: 'cert-id',
    refreshToken: 'refresh-1',
  };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (credentials = CREDENTIALS, settings: Record<string, unknown> = {}) =>
    new EbayConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const calls = () => httpClient.request.mock.calls;
  const lastCall = () => calls()[calls().length - 1];
  const tokenCall = () => calls().find((c) => String(c[0]).includes('/identity/v1/oauth2/token'));

  /** Token exchange first, then whatever the API call under test returns. */
  const mockTokenThen = (payload: unknown, token: Record<string, unknown> = {}) => {
    httpClient.request
      .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 7200, ...token })
      .mockResolvedValue(payload);
  };

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('marketplace handling', () => {
    it('refuses to construct without a marketplace', () => {
      const { marketplace, ...without } = CREDENTIALS;
      expect(() => build(without as any)).toThrow(/pazar seçilmedi/i);
    });

    it('refuses an unsupported marketplace instead of calling eBay', () => {
      expect(() => build({ ...CREDENTIALS, marketplace: 'EBAY_ATLANTIS' })).toThrow(
        /desteklenmeyen pazar/i,
      );
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('normalises a lower-case marketplace', async () => {
      mockTokenThen({ orders: [], total: 0 });

      await build({ ...CREDENTIALS, marketplace: 'ebay_gb' }).testConnection();

      expect(lastCall()[1].headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_GB');
    });

    it('gives each marketplace its own throttling bucket', async () => {
      mockTokenThen({ orders: [], total: 0 });
      await build({ ...CREDENTIALS, marketplace: 'EBAY_US' }).testConnection();
      await build({ ...CREDENTIALS, marketplace: 'EBAY_DE' }).testConnection();

      const keys = rateLimiter.throttle.mock.calls.map((c) => c[0]);
      expect(keys).toContain('EBAY:EBAY_US');
      expect(keys).toContain('EBAY:EBAY_DE');
    });
  });

  describe('OAuth', () => {
    it('exchanges the refresh token with Basic app credentials, form encoded', async () => {
      mockTokenThen({ orders: [], total: 0 });

      await build().testConnection();

      const [url, options] = tokenCall()!;
      expect(url).toBe('https://api.ebay.com/identity/v1/oauth2/token');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(options.headers.Authorization).toBe(
        `Basic ${Buffer.from('app-id:cert-id').toString('base64')}`,
      );
      expect(options.body).toContain('grant_type=refresh_token');
      expect(options.body).toContain('refresh_token=refresh-1');
    });

    it('sends the access token as a bearer on the API call', async () => {
      mockTokenThen({ orders: [], total: 0 });

      await build().testConnection();

      expect(lastCall()[1].headers.Authorization).toBe('Bearer access-1');
    });

    it('reuses the access token instead of exchanging on every call', async () => {
      mockTokenThen({ orders: [], total: 0 });

      const connector = build();
      await connector.getOrders();
      await connector.getOrders();

      expect(calls().filter((c) => String(c[0]).includes('/oauth2/token'))).toHaveLength(1);
    });

    it('targets the sandbox host when the environment says so', async () => {
      mockTokenThen({ orders: [], total: 0 });

      await build(CREDENTIALS, { 'general.environment': 'sandbox' }).testConnection();

      expect(tokenCall()![0]).toContain('https://api.sandbox.ebay.com');
      expect(lastCall()[0]).toContain('https://api.sandbox.ebay.com');
    });

    it('reports a replacement refresh token so the caller can persist it', async () => {
      mockTokenThen({ orders: [], total: 0 }, { refresh_token: 'refresh-2' });

      const connector = build();
      await connector.testConnection();

      expect(connector.consumeRotatedCredentials()).toEqual({ refreshToken: 'refresh-2' });
    });

    it('does not report a rotation when eBay returns the same refresh token', async () => {
      mockTokenThen({ orders: [], total: 0 }, { refresh_token: 'refresh-1' });

      const connector = build();
      await connector.testConnection();

      expect(connector.consumeRotatedCredentials()).toBeUndefined();
    });

    it('explains an expired refresh token instead of leaking the status', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 400),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/refresh token/i);
    });
  });

  describe('getOrders', () => {
    const order = (id: string, status: string) => ({
      orderId: id,
      orderFulfillmentStatus: status,
      orderPaymentStatus: 'PAID',
      pricingSummary: { total: { value: '25.50', currency: 'USD' } },
      buyer: { username: 'buyer1' },
      fulfillmentStartInstructions: [
        {
          shippingStep: {
            shipTo: {
              fullName: 'Ada Lovelace',
              contactAddress: { addressLine1: '1 Main St', city: 'Austin', countryCode: 'US' },
            },
          },
        },
      ],
      lineItems: [
        { sku: 'SKU-1', title: 'Widget', quantity: 2, lineItemCost: { value: '10.00' } },
      ],
    });

    it('maps an eBay order onto the shared shape', async () => {
      mockTokenThen({ orders: [order('12-345', 'NOT_STARTED')], total: 1 });

      const [unified] = await build().getOrders();

      expect(unified).toMatchObject({
        orderNumber: '12-345',
        customerName: 'Ada Lovelace',
        status: 'pending',
        paymentStatus: 'paid',
        totalAmount: 25.5,
        currency: 'USD',
        source: 'ebay',
      });
      expect(unified.items).toEqual([
        { sku: 'SKU-1', name: 'Widget', quantity: 2, unitPrice: 10, totalPrice: 20 },
      ]);
    });

    it('translates the fulfilment state rather than passing it through', async () => {
      mockTokenThen({ orders: [order('1', 'FULFILLED')], total: 1 });
      expect((await build().getOrders())[0].status).toBe('shipped');
    });

    it('does not invent a currency when the payload omits it', async () => {
      mockTokenThen({
        orders: [{ orderId: '1', lineItems: [], pricingSummary: { total: { value: '5' } } }],
        total: 1,
      });

      expect((await build().getOrders())[0].currency).not.toBe('USD');
    });

    it('asks only for orders inside the backfill window', async () => {
      mockTokenThen({ orders: [], total: 0 });

      await build(CREDENTIALS, { 'orders.backfillDays': 3 }).getOrders();

      const filter = String(lastCall()[0]);
      expect(filter).toContain('creationdate');
    });
  });

  describe('updateStock', () => {
    it('posts the SKU and quantity to the bulk endpoint', async () => {
      mockTokenThen({});

      const result = await build().updateStock('SKU-1', 7);

      expect(result).toEqual({ sku: 'SKU-1', quantity: 7, success: true });
      const [url, options] = lastCall();
      expect(url).toContain('/sell/inventory/v1/bulk_update_price_quantity');
      expect(JSON.parse(options.body)).toEqual({
        requests: [{ sku: 'SKU-1', shipToLocationAvailability: { quantity: 7 } }],
      });
    });

    it('reports failure instead of throwing so one SKU cannot abort a sync', async () => {
      httpClient.request
        .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 7200 })
        .mockRejectedValue(new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 404));

      const result = await build().updateStock('UNKNOWN-SKU', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('splits a batch at eBay documented limit of 25 SKUs per call', async () => {
      mockTokenThen({});
      const updates = Array.from({ length: 26 }, (_, i) => ({ sku: `SKU-${i}`, quantity: 1 }));

      const results = await build().updateStockBatch(updates);

      const bulkCalls = calls().filter((c) => String(c[0]).includes('bulk_update_price_quantity'));
      expect(bulkCalls).toHaveLength(2);
      expect(JSON.parse(bulkCalls[0][1].body).requests).toHaveLength(25);
      expect(JSON.parse(bulkCalls[1][1].body).requests).toHaveLength(1);
      expect(results).toHaveLength(26);
    });
  });

  describe('categories', () => {
    it('resolves the marketplace category tree id once and reuses it', async () => {
      httpClient.request
        .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 7200 })
        .mockResolvedValueOnce({ categoryTreeId: '0' })
        .mockResolvedValue({ rootCategoryNode: { childCategoryTreeNodes: [{ categoryId: '1' }] } });

      const connector = build();
      await connector.getCategories();
      await connector.getCategories();

      const treeIdCalls = calls().filter((c) =>
        String(c[0]).includes('get_default_category_tree_id'),
      );
      expect(treeIdCalls).toHaveLength(1);
      expect(String(treeIdCalls[0][0])).toContain('marketplace_id=EBAY_US');
    });

    it('surfaces a failure rather than substituting a fake tree', async () => {
      httpClient.request
        .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 7200 })
        .mockRejectedValue(new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 500));

      await expect(build().getCategories()).rejects.toThrow();
    });
  });

  describe('getProducts', () => {
    it('maps inventory items and leaves price unknown rather than reporting zero as real', async () => {
      mockTokenThen({
        inventoryItems: [
          {
            sku: 'SKU-1',
            product: { title: 'Widget', imageUrls: ['http://img'], ean: ['111'] },
            availability: { shipToLocationAvailability: { quantity: 4 } },
          },
        ],
      });

      const [product] = await build().getProducts();

      expect(product).toMatchObject({
        sku: 'SKU-1',
        name: 'Widget',
        stockQuantity: 4,
        image: 'http://img',
        barcode: '111',
      });
    });
  });
});
