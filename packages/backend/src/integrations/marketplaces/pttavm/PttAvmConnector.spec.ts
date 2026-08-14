import { HttpStatus } from '@nestjs/common';
import { PttAvmConnector } from './PttAvmConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * Pins the request shape and status folding. NOT proof the endpoints exist;
 * PttAVM's path set is one of the two least-documented in this codebase and
 * needs live verification before it is trusted.
 */
describe('PttAvmConnector', () => {
  const CREDENTIALS = { apiKey: 'ptt-key', apiSecret: 'ptt-secret' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new PttAvmConnector(
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

  it('should authenticate with Basic auth', async () => {
    httpClient.request.mockResolvedValue({ items: [], totalCount: 6 });

    const result = await build().testConnection();

    expect(result.success).toBe(true);
    const [url, options] = lastCall();
    expect(url).toContain('https://api.pttavm.com/products');
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('ptt-key:ptt-secret').toString('base64')}`,
    );
  });

  it('should name the missing credential before calling', async () => {
    const result = await build({}, { apiKey: 'k', apiSecret: '' }).testConnection();

    expect(result.success).toBe(false);
    expect(result.message).toContain('apiSecret');
    expect(httpClient.request).not.toHaveBeenCalled();
  });

  it('should stop paging on a short page', async () => {
    httpClient.request.mockResolvedValue({
      items: [{ stockCode: 'SKU-1', name: 'Ürün', price: 10, quantity: 2 }],
      totalPages: 7,
    });

    const products = await build().getProducts();

    expect(httpClient.request).toHaveBeenCalledTimes(1);
    expect(products[0]).toMatchObject({ sku: 'SKU-1', name: 'Ürün', stockQuantity: 2 });
  });

  it('should map an order and fold its status', async () => {
    httpClient.request.mockResolvedValue({
      items: [
        {
          id: 3,
          orderNumber: 'PTT-1',
          status: 'approved',
          customerName: 'Ada Lovelace',
          totalPrice: 60,
          shippingAddress: { address: 'Sokak 1', city: 'Ankara', district: 'Çankaya' },
          items: [{ stockCode: 'SKU-1', productName: 'Ürün', quantity: 3, price: 20 }],
        },
      ],
      totalPages: 1,
    });

    const orders = await build({ 'orders.importStatuses': ['picking'] }).getOrders();

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      orderNumber: 'PTT-1',
      customerName: 'Ada Lovelace',
      source: 'pttavm',
      totalAmount: 60,
    });
    expect(orders[0].items).toEqual([
      { sku: 'SKU-1', name: 'Ürün', quantity: 3, unitPrice: 20, totalPrice: 60 },
    ]);
  });

  it('should post the stock code and quantity', async () => {
    httpClient.request.mockResolvedValue({});

    const result = await build().updateStock('SKU-5', 3);

    expect(result).toEqual({ sku: 'SKU-5', quantity: 3, success: true });
    expect(lastCall()[0]).toContain('/products/stock');
    expect(JSON.parse(lastCall()[1].body)).toEqual({ items: [{ stockCode: 'SKU-5', quantity: 3 }] });
  });

  it('should explain a 401 rather than leaking the status', async () => {
    httpClient.request.mockRejectedValue(
      new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 401),
    );

    const result = await build().testConnection();

    expect(result.success).toBe(false);
    expect(result.message).toContain('kimlik doğrulaması reddedildi');
  });
});
