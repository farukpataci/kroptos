import { HttpStatus } from '@nestjs/common';
import { CicekSepetiConnector } from './CicekSepetiConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * Pins the request shape and status folding. NOT proof the endpoints exist;
 * live verification against a real seller account is outstanding.
 */
describe('CicekSepetiConnector', () => {
  const CREDENTIALS = { apiKey: 'cs-key' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new CicekSepetiConnector(
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

  it('should authenticate with the single x-api-key header', async () => {
    httpClient.request.mockResolvedValue({ productList: [], totalCount: 2 });

    const result = await build().testConnection();

    expect(result.success).toBe(true);
    const [url, options] = lastCall();
    expect(url).toContain('https://apis.ciceksepeti.com/api/v1/Product/GetProducts');
    expect(options.headers['x-api-key']).toBe('cs-key');
  });

  it('should name the missing credential instead of calling the API', async () => {
    const result = await build({}, { apiKey: '' }).testConnection();

    expect(result.success).toBe(false);
    expect(result.message).toContain('apiKey');
    expect(httpClient.request).not.toHaveBeenCalled();
  });

  it('should stop paging on a short page', async () => {
    httpClient.request.mockResolvedValue({
      productList: [{ stockCode: 'SKU-1', name: 'Gül', price: 100, stock: 4 }],
      pageCount: 9,
    });

    const products = await build().getProducts();

    expect(httpClient.request).toHaveBeenCalledTimes(1);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ sku: 'SKU-1', name: 'Gül', stockQuantity: 4 });
  });

  it('should read orders from the orderList key and map them', async () => {
    httpClient.request.mockResolvedValue({
      orderList: [
        {
          id: 7,
          orderCode: 'CS-1',
          status: 'Created',
          receiverName: 'Ada Lovelace',
          address: 'Sokak 1',
          city: 'Ankara',
          district: 'Çankaya',
          totalPrice: 150,
          items: [{ variantCode: 'SKU-1', name: 'Buket', quantity: 1, price: 150 }],
        },
      ],
      pageCount: 1,
    });

    const [unified] = await build().getOrders();

    expect(unified).toMatchObject({
      customerName: 'Ada Lovelace',
      status: 'pending',
      source: 'ciceksepeti',
      totalAmount: 150,
    });
    expect(unified.items).toEqual([
      { sku: 'SKU-1', name: 'Buket', quantity: 1, unitPrice: 150, totalPrice: 150 },
    ]);
  });

  it('should fold a lowercase status onto the capitalised name the mapper expects', async () => {
    const order = (orderCode: string, status: string) => ({
      id: 1,
      orderCode,
      status,
      receiverName: 'A',
      address: '',
      city: '',
      district: '',
      totalPrice: 1,
      items: [],
    });

    httpClient.request.mockResolvedValue({
      orderList: [order('CS-1', 'delivered'), order('CS-2', 'cancelled')],
      pageCount: 1,
    });

    const orders = await build({ 'orders.importStatuses': ['delivered'] }).getOrders();

    expect(orders.map((o) => o.orderNumber)).toEqual(['CS-1']);
    expect(orders[0].status).toBe('delivered');
  });

  it('should post the stock code and quantity', async () => {
    httpClient.request.mockResolvedValue({});

    const result = await build().updateStock('SKU-3', 7);

    expect(result).toEqual({ sku: 'SKU-3', quantity: 7, success: true });
    expect(JSON.parse(lastCall()[1].body)).toEqual({
      products: [{ stockCode: 'SKU-3', stockQuantity: 7 }],
    });
  });

  it('should explain a 403 as an authentication refusal', async () => {
    httpClient.request.mockRejectedValue(
      new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 403),
    );

    const result = await build().testConnection();

    expect(result.success).toBe(false);
    expect(result.message).toContain('kimlik doğrulaması reddedildi');
  });
});
