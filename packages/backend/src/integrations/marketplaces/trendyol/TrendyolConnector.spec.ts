import { HttpStatus } from '@nestjs/common';
import { TrendyolConnector } from './TrendyolConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * These tests pin the request shape (URL, auth header, paging) and the error
 * mapping. They are NOT proof that the endpoints exist: a mock answers whatever
 * it is told to, in the right shape or the wrong one. Live verification against
 * a real seller account is still outstanding.
 */
describe('TrendyolConnector', () => {
  const CREDENTIALS = { sellerId: '123456', apiKey: 'key-abc', apiSecret: 'secret-xyz' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new TrendyolConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const lastCall = () => httpClient.request.mock.calls[httpClient.request.mock.calls.length - 1];

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('authentication', () => {
    it('should send Basic auth and the seller-scoped User-Agent', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalElements: 7, totalPages: 1 });

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      const [url, options] = lastCall();
      expect(url).toContain('https://apigw.trendyol.com/integration/product/sellers/123456/products');
      expect(options.headers.Authorization).toBe(
        `Basic ${Buffer.from('key-abc:secret-xyz').toString('base64')}`,
      );
      expect(options.headers['User-Agent']).toBe('123456 - SelfIntegration');
    });

    it('should target the stage gateway when the environment is sandbox', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build({ 'general.environment': 'sandbox' }).getProducts();

      expect(lastCall()[0]).toContain('https://stageapigw.trendyol.com');
    });

    // Trendyol documents storeFrontCode as a header parameter. It used to be
    // appended to the query string, where the gateway ignores it — so every
    // call silently ran against the account's default storefront.
    //
    // The value is the ISO country code. A numeric storefront id ('1') is
    // accepted by the products endpoint but 400s on orders and
    // product-categories, which is how it survived a green connection test.
    it('should send the storefront as a header, never in the query string', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build().getProducts();

      const [url, options] = lastCall();
      expect(options.headers.storeFrontCode).toBe('TR');
      expect(url).not.toContain('storeFrontCode');
    });

    it('should scope orders, products and categories to Türkiye', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1, categories: [] });

      const connector = build();
      await connector.getProducts();
      expect(lastCall()[1].headers.storeFrontCode).toBe('TR');

      await connector.getOrders();
      expect(lastCall()[1].headers.storeFrontCode).toBe('TR');

      await connector.getCategories();
      expect(lastCall()[1].headers.storeFrontCode).toBe('TR');
    });

    // This provider is Türkiye. Anything international is `trendyol_global`,
    // which is a separate integration record with its own country.
    it('should ignore a leftover storefront setting instead of switching country', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build({ 'trendyol.marketplace': 'de' }).getProducts();

      expect(lastCall()[1].headers.storeFrontCode).toBe('TR');
    });

    it('should say Türkiye in the connection test message', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalElements: 4, totalPages: 1 });

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Türkiye');
    });

    it('should fail before any request when a credential field is empty', async () => {
      const result = await build({}, { sellerId: '123456', apiKey: '', apiSecret: 'x' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('apiKey');
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });

  describe('testConnection error mapping', () => {
    it('should explain a 401 instead of leaking the raw status', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 401, '{"errors":["unauthorized"]}'),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('kimlik doğrulaması reddedildi');
      expect(result.message).toContain('401');
    });

    it('should point at the rate limit setting on a 429', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 429),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('advanced.rateLimitPerMinute');
    });

    // A 400 is a validation answer and the body names the rejected field. It
    // used to be dropped, leaving the UI with a bare "status 400" — which is
    // how the wrong storefrontCode value survived a green connection test.
    it('should carry the upstream body through on a 400', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError(
          'Marketplace HTTP Request failed with status 400: Bad Request',
          HttpStatus.BAD_GATEWAY,
          400,
          '{"exception":"ValidationException","errors":[{"key":"storeFrontCode","message":"invalid storefrontCode"}]}',
        ),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid storefrontCode');
    });

    // The stage gateway answers every path with Cloudflare's block page, so an
    // HTML body means the request never reached Trendyol. Saying that beats
    // pasting 300 characters of markup into the seller's screen.
    it('should say a gateway blocked the request when the body is HTML', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError(
          'failed',
          HttpStatus.BAD_GATEWAY,
          403,
          '<!DOCTYPE html><html><head><title>Attention Required! | Cloudflare</title></head>',
        ),
      );

      const result = await build({ 'general.environment': 'sandbox' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('engellendi');
      expect(result.message).not.toContain('DOCTYPE');
    });
  });

  describe('getOrders', () => {
    const order = (orderNumber: string, status: string) => ({
      id: 1,
      orderNumber,
      status,
      customerFirstName: 'Ada',
      customerLastName: 'Lovelace',
      totalPrice: 100,
      currencyCode: 'TRY',
      shipmentAddress: { address1: 'Sokak 1', city: 'İstanbul', countryCode: 'TR' },
      lines: [{ barcode: '869', merchantSku: 'SKU-1', quantity: 2, price: 50, productName: 'Ürün' }],
    });

    it('should walk every page and merge the results', async () => {
      httpClient.request
        .mockResolvedValueOnce({ content: [order('TY-1', 'Created')], totalPages: 2 })
        .mockResolvedValueOnce({ content: [order('TY-2', 'Created')], totalPages: 2 });

      const orders = await build().getOrders();

      expect(httpClient.request).toHaveBeenCalledTimes(2);
      expect(orders.map((o) => o.orderNumber)).toEqual(['TY-1', 'TY-2']);
      expect(lastCall()[0]).toContain('page=1');
      expect(lastCall()[0]).toContain('size=200');
    });

    it('should keep only the statuses selected in settings', async () => {
      httpClient.request.mockResolvedValue({
        content: [order('TY-1', 'Created'), order('TY-2', 'Cancelled')],
        totalPages: 1,
      });

      const orders = await build({ 'orders.importStatuses': ['created'] }).getOrders();

      expect(orders.map((o) => o.orderNumber)).toEqual(['TY-1']);
    });

    it('should derive the start date from orders.backfillDays', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build({ 'orders.backfillDays': 3 }).getOrders();

      const url = new URL(lastCall()[0]);
      const startDate = Number(url.searchParams.get('startDate'));
      const expected = Date.now() - 3 * 24 * 60 * 60 * 1000;
      expect(Math.abs(startDate - expected)).toBeLessThan(10_000);
    });

    it('should map a Trendyol line onto the unified order shape', async () => {
      httpClient.request.mockResolvedValue({ content: [order('TY-9', 'Created')], totalPages: 1 });

      const [unified] = await build().getOrders();

      expect(unified).toMatchObject({
        orderNumber: 'TY-9',
        customerName: 'Ada Lovelace',
        status: 'pending',
        source: 'trendyol',
        currency: 'TRY',
      });
      expect(unified.items).toEqual([
        { sku: 'SKU-1', name: 'Ürün', quantity: 2, unitPrice: 50, totalPrice: 100 },
      ]);
    });

    // Both settings were offered in the UI and read by nobody: the seller saw
    // them saved and they changed nothing.
    it("should apply the seller's orders.statusMap over the built-in table", async () => {
      httpClient.request.mockResolvedValue({
        content: [order('TY-1', 'Picking'), order('TY-2', 'Created')],
        totalPages: 1,
      });

      const orders = await build({
        'orders.importStatuses': ['created', 'picking'],
        'orders.statusMap': { picking: 'processing' },
      }).getOrders();

      // 'Picking' has no row in the mapper's table and used to land on
      // 'pending'; 'Created' keeps the built-in mapping.
      expect(orders.map((o) => o.status)).toEqual(['processing', 'pending']);
    });

    it('should ignore a status the rest of the system does not know', async () => {
      httpClient.request.mockResolvedValue({ content: [order('TY-1', 'Created')], totalPages: 1 });

      const [unified] = await build({ 'orders.statusMap': { created: 'made-up' } }).getOrders();

      expect(unified.status).toBe('pending');
    });

    it('should prefix imported order numbers with orders.numberPrefix', async () => {
      httpClient.request.mockResolvedValue({ content: [order('65530680', 'Created')], totalPages: 1 });

      const [unified] = await build({ 'orders.numberPrefix': 'TY-' }).getOrders();

      expect(unified.orderNumber).toBe('TY-65530680');
    });
  });

  describe('updateStock', () => {
    it('should post the barcode and quantity', async () => {
      httpClient.request.mockResolvedValue({ batchRequestId: 'b-1' });

      const result = await build().updateStock('869123', 42);

      expect(result).toEqual({ sku: '869123', quantity: 42, success: true });
      const [url, options] = lastCall();
      expect(url).toContain('/integration/inventory/sellers/123456/products/price-and-inventory');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ items: [{ barcode: '869123', quantity: 42 }] });
    });

    // Trendyol matches inventory on the barcode and accepts a batch that
    // matches nothing without complaining, so sending the local SKU was a
    // silent no-op wherever SKU and barcode differ.
    it('should send the barcode the caller supplies, not the local SKU', async () => {
      httpClient.request.mockResolvedValue({ batchRequestId: 'b-1' });

      const result = await build().updateStock('KROP-TSHIRT-M', 7, { barcode: '8690000000001' });

      expect(JSON.parse(lastCall()[1].body)).toEqual({
        items: [{ barcode: '8690000000001', quantity: 7 }],
      });
      // The result still reports the SKU: that is what the caller asked about.
      expect(result).toEqual({ sku: 'KROP-TSHIRT-M', quantity: 7, success: true });
    });

    it('should fall back to the SKU when the product has no barcode', async () => {
      httpClient.request.mockResolvedValue({ batchRequestId: 'b-1' });

      await build().updateStock('869123', 3, { barcode: null });

      expect(JSON.parse(lastCall()[1].body)).toEqual({ items: [{ barcode: '869123', quantity: 3 }] });
    });

    it('should report failure instead of throwing so one SKU cannot abort a sync', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 401),
      );

      const result = await build().updateStock('869123', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('kimlik doğrulaması reddedildi');
    });
  });

  describe('categories', () => {
    it('should return the categories the API sends', async () => {
      httpClient.request.mockResolvedValue({ categories: [{ id: 1, name: 'Tişört' }] });

      await expect(build().getCategories()).resolves.toEqual([{ id: 1, name: 'Tişört' }]);
    });

    it('should surface a failure rather than substituting a fake tree', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 500),
      );

      await expect(build().getCategories()).rejects.toThrow('Trendyol tarafında geçici hata');
    });
  });

  // Feeds the two required address fields in the settings form. The manifest
  // pointed at this endpoint before it existed, so the form could not be
  // completed at all.
  describe('addresses', () => {
    it('should return id/label rows the settings form can render', async () => {
      httpClient.request.mockResolvedValue({
        supplierAddresses: [
          {
            id: 55,
            address: 'Sokak 1 No 2',
            district: 'Kadıköy',
            city: 'İstanbul',
            shipment: true,
            returningAddress: false,
            invoice: true,
            default: true,
          },
        ],
      });

      const [address] = await build().getAddresses();

      expect(lastCall()[0]).toContain('/integration/sellers/123456/addresses');
      expect(address).toEqual({
        id: '55',
        label: 'Sokak 1 No 2, Kadıköy, İstanbul',
        shipment: true,
        returningAddress: false,
        invoice: true,
        isDefault: true,
      });
    });

    it('should keep a row selectable when it carries no readable address', async () => {
      httpClient.request.mockResolvedValue({ supplierAddresses: [{ id: 7 }] });

      const [address] = await build().getAddresses();

      expect(address).toMatchObject({ id: '7', label: '#7' });
    });

    it('should return an empty list rather than throwing on an unexpected shape', async () => {
      httpClient.request.mockResolvedValue({});

      await expect(build().getAddresses()).resolves.toEqual([]);
    });
  });
});
