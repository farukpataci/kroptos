import { AliExpressConnector } from './AliExpressConnector';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * These pin the transport — gateway, signed envelope, business-error unwrapping
 * — and the refusals. They are NOT proof the signature variant or the method
 * names are right; the refusal cases exist so those gaps fail loudly.
 */
describe('AliExpressConnector', () => {
  const CREDENTIALS = { appKey: 'app-key', appSecret: 'app-secret', accessToken: 'token-1' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (credentials = CREDENTIALS, settings: Record<string, unknown> = {}) =>
    new AliExpressConnector(
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
    it('posts to the current gateway, not the legacy one', async () => {
      httpClient.request.mockResolvedValue({});

      await build().testConnection();

      const [url, options] = lastCall();
      expect(url).toBe('https://api-sg.aliexpress.com/sync');
      expect(url).not.toContain('gw.api.taobao.com');
      expect(options.method).toBe('POST');
    });

    it('carries the signed system envelope', async () => {
      httpClient.request.mockResolvedValue({});

      await build().testConnection();

      const body = lastBody();
      expect(body).toMatchObject({
        app_key: 'app-key',
        method: 'aliexpress.solution.order.info.get',
        session: 'token-1',
        format: 'json',
        v: '2.0',
        sign_method: 'sha256',
      });
      expect(body.sign).toMatch(/^[0-9A-F]+$/);
    });

    it('never puts the app secret on the wire', async () => {
      httpClient.request.mockResolvedValue({});

      await build().testConnection();

      expect(lastCall()[1].body).not.toContain('app-secret');
    });

    it('fails before any request when a credential is missing', async () => {
      const { appSecret, ...without } = CREDENTIALS;

      const result = await build(without as any).testConnection();

      expect(result.success).toBe(false);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('separates throttling per app key', async () => {
      httpClient.request.mockResolvedValue({});

      await build().testConnection();
      await build({ ...CREDENTIALS, appKey: 'other-key' }).testConnection();

      expect(new Set(rateLimiter.throttle.mock.calls.map((c) => c[0])).size).toBe(2);
    });
  });

  describe('business errors', () => {
    it('treats error_response as a failure even though the HTTP call succeeded', async () => {
      // AliExpress answers 200 for business failures; trusting the status code
      // is how a sync silently imports nothing.
      httpClient.request.mockResolvedValue({
        error_response: { code: 15, msg: 'Invalid signature' },
      });

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid signature');
      expect(result.message).toContain('15');
    });

    it('surfaces a signature rejection rather than reporting a healthy connection', async () => {
      // With the signature variant unconfirmed this is the expected first
      // signal, so it must reach the user intact.
      httpClient.request.mockResolvedValue({
        error_response: { code: 25, sub_msg: 'sign check failed' },
      });

      expect((await build().testConnection()).message).toContain('sign check failed');
    });
  });

  describe('operations whose method name was never confirmed', () => {
    it('refuses getOrders: only single-order detail is confirmed, which is not a sync', async () => {
      await expect(build().getOrders()).rejects.toThrow(/METHODS\.orderList/);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('refuses getProducts and names the constant to fill in', async () => {
      await expect(build().getProducts()).rejects.toThrow(/METHODS\.products/);
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
