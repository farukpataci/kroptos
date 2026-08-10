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
    it('should send the storefront as a header, never in the query string', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build({ 'trendyol.marketplace': 'de' }).getProducts();

      const [url, options] = lastCall();
      expect(options.headers.storeFrontCode).toBe('DE');
      expect(url).not.toContain('storeFrontCode');
    });

    it('should send the documented Türkiye storefront code', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build().getProducts();

      expect(lastCall()[1].headers.storeFrontCode).toBe('1');
    });

    it('should scope both orders and products to the selected storefront', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      const connector = build({ 'trendyol.marketplace': 'de' });
      await connector.getProducts();
      expect(lastCall()[1].headers.storeFrontCode).toBe('DE');

      await connector.getOrders();
      expect(lastCall()[1].headers.storeFrontCode).toBe('DE');
    });

    it('should carry the storefront on category reads too', async () => {
      httpClient.request.mockResolvedValue({ categories: [] });

      await build({ 'trendyol.marketplace': 'de' }).getCategories();

      expect(lastCall()[1].headers.storeFrontCode).toBe('DE');
    });

    it('should name the marketplace in the connection test message', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalElements: 4, totalPages: 1 });

      const result = await build({ 'trendyol.marketplace': 'int' }).testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Trendyol Global');
      expect(lastCall()[1].headers.storeFrontCode).toBe('INT');
    });

    it('should fall back to Türkiye when the marketplace value is unknown', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build({ 'trendyol.marketplace': 'atlantis' }).getProducts();

      expect(lastCall()[1].headers.storeFrontCode).toBe('1');
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
});
