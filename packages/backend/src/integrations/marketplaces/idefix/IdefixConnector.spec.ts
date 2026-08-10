import { HttpStatus } from '@nestjs/common';
import { IdefixConnector } from './IdefixConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * Pins the request shape, vendor scoping and status folding. NOT proof the
 * endpoints exist; idefix's path set is one of the two least-documented in this
 * codebase and needs live verification before it is trusted.
 */
describe('IdefixConnector', () => {
  const CREDENTIALS = { vendorId: 'v-77', apiKey: 'idf-key', apiSecret: 'idf-secret' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new IdefixConnector(
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

  it('should scope the path by vendor id and authenticate with Basic auth', async () => {
    httpClient.request.mockResolvedValue({ content: [], totalElements: 9, totalPages: 1 });

    const result = await build().testConnection();

    expect(result.success).toBe(true);
    const [url, options] = lastCall();
    expect(url).toContain('https://sellerapi.idefix.com/products/vendors/v-77');
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('idf-key:idf-secret').toString('base64')}`,
    );
    expect(options.headers['User-Agent']).toBe('v-77 - SelfIntegration');
  });

  it('should refuse before calling when the vendor id is missing', async () => {
    const result = await build({}, { ...CREDENTIALS, vendorId: '' }).testConnection();

    expect(result.success).toBe(false);
    expect(result.message).toContain('vendorId');
    expect(httpClient.request).not.toHaveBeenCalled();
  });

  it('should walk every page of the vendor product list', async () => {
    httpClient.request
      .mockResolvedValueOnce({
        content: [{ merchantSku: 'SKU-1', title: 'Kitap', salePrice: 90, quantity: 4 }],
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        content: [{ merchantSku: 'SKU-2', title: 'Defter', salePrice: 30, quantity: 1 }],
        totalPages: 2,
      });

    const products = await build().getProducts();

    expect(httpClient.request).toHaveBeenCalledTimes(2);
    expect(products.map((p) => p.sku)).toEqual(['SKU-1', 'SKU-2']);
    expect(lastCall()[0]).toContain('page=1');
  });

  it('should map an order and keep only the selected statuses', async () => {
    const order = (orderNumber: string, status: string) => ({
      id: 1,
      orderNumber,
      status,
      customerName: 'Ada Lovelace',
      totalPrice: 90,
      shippingAddress: { address: 'Sokak 1', city: 'İstanbul', district: 'Kadıköy' },
      items: [{ merchantSku: 'SKU-1', productName: 'Kitap', quantity: 1, price: 90 }],
    });

    httpClient.request.mockResolvedValue({
      content: [order('IDF-1', 'shipped'), order('IDF-2', 'cancelled')],
      totalPages: 1,
    });

    const orders = await build({ 'orders.importStatuses': ['shipped'] }).getOrders();

    expect(orders.map((o) => o.orderNumber)).toEqual(['IDF-1']);
    expect(orders[0]).toMatchObject({ status: 'shipped', source: 'idefix' });
    expect(orders[0].items).toEqual([
      { sku: 'SKU-1', name: 'Kitap', quantity: 1, unitPrice: 90, totalPrice: 90 },
    ]);
  });

  it('should post the merchant SKU on a stock update', async () => {
    httpClient.request.mockResolvedValue({});

    const result = await build().updateStock('SKU-9', 6);

    expect(result).toEqual({ sku: 'SKU-9', quantity: 6, success: true });
    expect(lastCall()[0]).toContain('/products/vendors/v-77/stock');
    expect(JSON.parse(lastCall()[1].body)).toEqual({ items: [{ merchantSku: 'SKU-9', quantity: 6 }] });
  });

  it('should map a 429 onto the rate limit setting', async () => {
    httpClient.request.mockRejectedValue(
      new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 429),
    );

    const result = await build().testConnection();

    expect(result.success).toBe(false);
    expect(result.message).toContain('advanced.rateLimitPerMinute');
  });
});
