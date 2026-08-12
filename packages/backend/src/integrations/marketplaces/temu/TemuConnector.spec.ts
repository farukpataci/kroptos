import { TemuConnector } from './TemuConnector';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * These pin the transport — the POST envelope, the signature, the business
 * error unwrapping — and the refusals. They are NOT proof that the gateway or
 * the method names are right; both are unverified, and the refusal cases below
 * exist precisely so that gap fails loudly instead of silently.
 */
describe('TemuConnector', () => {
  const CREDENTIALS = {
    apiUrl: 'https://openapi.example.temu.com/openapi/router',
    appKey: 'app-key',
    appSecret: 'app-secret',
    accessToken: 'token-1',
  };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (credentials = CREDENTIALS, settings: Record<string, unknown> = {}) =>
    new TemuConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const lastCall = () => httpClient.request.mock.calls[httpClient.request.mock.calls.length - 1];
  const lastBody = () => JSON.parse(lastCall()[1].body);

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('transport', () => {
    it('posts to the gateway the seller supplied', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [] } });

      await build().getOrders();

      const [url, options] = lastCall();
      expect(url).toBe('https://openapi.example.temu.com/openapi/router');
      expect(options.method).toBe('POST');
    });

    it('accepts a bare host and normalises it to https', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [] } });

      await build({ ...CREDENTIALS, apiUrl: 'openapi.example.temu.com' }).getOrders();

      // URL normalisation adds the root path back to a bare origin, which is
      // what a POST to the host means anyway.
      expect(lastCall()[0]).toBe('https://openapi.example.temu.com/');
    });

    it('does not mangle a gateway that already carries a path', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [] } });

      await build().getOrders();

      expect(lastCall()[0]).toBe('https://openapi.example.temu.com/openapi/router');
    });

    it('refuses a malformed gateway rather than calling something arbitrary', async () => {
      const result = await build({ ...CREDENTIALS, apiUrl: 'http://' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/geçerli bir URL değil/i);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('fails before any request when the gateway is missing', async () => {
      const { apiUrl, ...without } = CREDENTIALS;

      const result = await build(without as any).testConnection();

      expect(result.success).toBe(false);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('carries the signed envelope on every call', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [] } });

      await build().getOrders();

      const body = lastBody();
      expect(body).toMatchObject({
        type: 'bg.order.list.v2.get',
        app_key: 'app-key',
        access_token: 'token-1',
        data_type: 'JSON',
      });
      expect(body.sign).toMatch(/^[0-9A-F]{32}$/);
    });

    it('never puts the app secret on the wire', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [] } });

      await build().getOrders();

      expect(lastCall()[1].body).not.toContain('app-secret');
    });

    it('gives each gateway its own throttling bucket', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [] } });

      await build().getOrders();
      await build({ ...CREDENTIALS, apiUrl: 'https://openapi-eu.example.temu.com' }).getOrders();

      const keys = rateLimiter.throttle.mock.calls.map((c) => c[0]);
      expect(new Set(keys).size).toBe(2);
    });
  });

  describe('business errors', () => {
    it('treats success:false as a failure even though the HTTP call succeeded', async () => {
      // Temu answers 200 for business failures; trusting the status code is how
      // a sync silently imports nothing.
      httpClient.request.mockResolvedValue({
        success: false,
        errorCode: 4000,
        errorMsg: 'invalid signature',
      });

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid signature');
      expect(result.message).toContain('4000');
    });
  });

  describe('orders', () => {
    const order = {
      parentOrderSn: 'PO-1',
      orderStatus: 1,
      orderAmount: 2599,
      currency: 'USD',
      receiverName: 'Ada Lovelace',
      addressDetail: '1 Main St',
      city: 'Austin',
      countryCode: 'US',
      itemList: [
        { skuCode: 'SKU-1', goodsName: 'Widget', quantity: 2, unitPrice: 1000, totalAmount: 2000 },
      ],
    };

    it('converts amounts out of minor units', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [order] } });

      const [unified] = await build().getOrders();

      expect(unified.totalAmount).toBe(25.99);
      expect(unified.items[0]).toMatchObject({ unitPrice: 10, totalPrice: 20 });
    });

    it('maps a Temu order onto the shared shape', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [order] } });

      const [unified] = await build().getOrders();

      expect(unified).toMatchObject({
        orderNumber: 'PO-1',
        customerName: 'Ada Lovelace',
        status: 'pending',
        currency: 'USD',
        source: 'temu',
      });
    });

    it('does not invent a currency when the payload omits one', async () => {
      const { currency, ...noCurrency } = order;
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [noCurrency] } });

      expect((await build().getOrders())[0].currency).toBe('');
    });

    it('stops paging when a short page comes back', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [order] } });

      await build().getOrders();

      expect(httpClient.request).toHaveBeenCalledTimes(1);
    });
  });

  describe('operations whose method name was never confirmed', () => {
    // The point of these: an unverified RPC name must announce itself, not be
    // guessed and fail later as an opaque marketplace error code.
    it('refuses getProducts and names the constant to fill in', async () => {
      await expect(build().getProducts()).rejects.toThrow(/METHODS\.products/);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('refuses getCategories and names the constant to fill in', async () => {
      await expect(build().getCategories()).rejects.toThrow(/METHODS\.categories/);
    });

    it('reports stock as failed rather than throwing, so one SKU cannot abort a sync', async () => {
      const result = await build().updateStock('SKU-1', 5);

      expect(result).toMatchObject({ sku: 'SKU-1', quantity: 5, success: false });
      expect(result.error).toMatch(/METHODS\.stock/);
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });
});
