import { HttpStatus } from '@nestjs/common';
import { N11Connector } from './N11Connector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * Pins the request shape and the numeric-status folding. NOT proof the
 * endpoints exist; live verification against a real seller account is
 * outstanding.
 */
describe('N11Connector', () => {
  const CREDENTIALS = { apiKey: 'app-key', apiSecret: 'app-secret' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new N11Connector(
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

  it('should authenticate with the appKey/appSecret header pair', async () => {
    httpClient.request.mockResolvedValue({ content: [], totalElements: 3 });

    const result = await build().testConnection();

    expect(result.success).toBe(true);
    const [url, options] = lastCall();
    expect(url).toContain('https://api.n11.com/ms/product-query/products');
    expect(options.headers.appKey).toBe('app-key');
    expect(options.headers.appSecret).toBe('app-secret');
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('should fail before any request when a credential is blank', async () => {
    const result = await build({}, { apiKey: 'k', apiSecret: '' }).testConnection();

    expect(result.success).toBe(false);
    expect(result.message).toContain('apiSecret');
    expect(httpClient.request).not.toHaveBeenCalled();
  });

  it('should search orders with a POST body carrying the paging block', async () => {
    httpClient.request.mockResolvedValue({ orderList: [], totalPages: 1 });

    await build({ 'orders.backfillDays': 2 }).getOrders();

    const [url, options] = lastCall();
    expect(url).toContain('/ms/order/list');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.pagingData).toEqual({ currentPage: 0, pageSize: 100 });
    const start = new Date(body.searchData.period.startDate).getTime();
    expect(Math.abs(start - (Date.now() - 2 * 24 * 60 * 60 * 1000))).toBeLessThan(10_000);
  });

  it('should unwrap the doubly nested order item list', async () => {
    httpClient.request.mockResolvedValue({
      orderList: [
        {
          id: 5,
          orderNumber: 'N11-1',
          status: 1,
          totalPrice: 80,
          buyer: { fullName: 'Ada Lovelace', email: 'ada@example.com' },
          shippingAddress: { address: 'Sokak 1', city: 'İzmir', district: 'Konak' },
          orderItemList: {
            orderItem: [
              { productSellerCode: 'SKU-1', productName: 'Ürün', quantity: 2, price: 40 },
            ],
          },
        },
      ],
      totalPages: 1,
    });

    const [unified] = await build().getOrders();

    expect(unified).toMatchObject({ orderNumber: 'N11-1', status: 'pending', source: 'n11' });
    expect(unified.items).toEqual([
      { sku: 'SKU-1', name: 'Ürün', quantity: 2, unitPrice: 40, totalPrice: 80 },
    ]);
  });

  it('should fold a textual status back onto the numeric code the mapper knows', async () => {
    const order = (orderNumber: string, status: unknown) => ({
      id: 1,
      orderNumber,
      status,
      totalPrice: 10,
      buyer: { fullName: 'A' },
      shippingAddress: {},
      orderItemList: { orderItem: [] },
    });

    httpClient.request.mockResolvedValue({
      orderList: [order('N11-1', 'Shipped'), order('N11-2', 'Cancelled')],
      totalPages: 1,
    });

    const orders = await build({ 'orders.importStatuses': ['shipped'] }).getOrders();

    expect(orders.map((o) => o.orderNumber)).toEqual(['N11-1']);
    expect(orders[0].status).toBe('shipped');
  });

  it('should post the stock code on a stock update', async () => {
    httpClient.request.mockResolvedValue({});

    const result = await build().updateStock('SKU-9', 5);

    expect(result).toEqual({ sku: 'SKU-9', quantity: 5, success: true });
    expect(JSON.parse(lastCall()[1].body)).toEqual({ items: [{ stockCode: 'SKU-9', quantity: 5 }] });
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
