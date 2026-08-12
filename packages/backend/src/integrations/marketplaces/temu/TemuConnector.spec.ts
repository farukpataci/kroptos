import { TemuConnector } from './TemuConnector';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * No Temu operation name is confirmed, so every public method refuses and the
 * connector makes no outbound request. The transport underneath is real code
 * that has to stay covered, so it is exercised through `call` with a method
 * name the test supplies itself — the transport is verified, the *name* is not,
 * and this keeps that distinction visible.
 */
class TransportProbe extends TemuConnector {
  callWith<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return this.call<T>(method, params);
  }
}

describe('TemuConnector', () => {
  const CREDENTIALS = {
    apiUrl: 'https://openapi.example.temu.com/openapi/router',
    appKey: 'app-key',
    appSecret: 'app-secret',
    accessToken: 'token-1',
  };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (credentials = CREDENTIALS) =>
    new TemuConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      {},
    );

  const probe = (credentials = CREDENTIALS) =>
    new TransportProbe(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      {},
    );

  const lastCall = () => httpClient.request.mock.calls[httpClient.request.mock.calls.length - 1];
  const lastBody = () => JSON.parse(lastCall()[1].body);

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('every operation refuses: no method name is confirmed', () => {
    it('refuses getOrders and names the constant to fill in', async () => {
      await expect(build().getOrders()).rejects.toThrow(/METHODS\.orders/);
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

    it('makes no outbound request from any operation', async () => {
      const connector = build();
      await connector.getOrders().catch(() => {});
      await connector.getProducts().catch(() => {});
      await connector.getCategories().catch(() => {});
      await connector.updateStock('x', 1);
      await connector.testConnection();

      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('fails, because there is no confirmed method to test with', async () => {
      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/metot adı yok/i);
      expect(result.message).toContain('METHODS');
    });

    it('says the credentials themselves are sound, so the seller is not sent hunting', async () => {
      // Distinguishing "your details are wrong" from "we have nothing to call"
      // is the whole point of validating first.
      expect((await build().testConnection()).message).toMatch(/biçimsel olarak geçerli/i);
    });

    it('reports a missing credential instead, when one is actually missing', async () => {
      const { appSecret, ...without } = CREDENTIALS;

      const result = await build(without as any).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('appSecret');
      expect(result.message).not.toMatch(/metot adı yok/i);
    });

    it('reports a malformed gateway instead of the missing-method message', async () => {
      const result = await build({ ...CREDENTIALS, apiUrl: 'http://' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/geçerli bir URL değil/i);
    });
  });

  describe('transport (exercised through call with a caller-supplied name)', () => {
    it('posts to the gateway the seller supplied', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: {} });

      await probe().callWith('some.method');

      const [url, options] = lastCall();
      expect(url).toBe('https://openapi.example.temu.com/openapi/router');
      expect(options.method).toBe('POST');
    });

    it('accepts a bare host and normalises it to https', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: {} });

      await probe({ ...CREDENTIALS, apiUrl: 'openapi.example.temu.com' }).callWith('some.method');

      // URL normalisation adds the root path back to a bare origin, which is
      // what a POST to the host means anyway.
      expect(lastCall()[0]).toBe('https://openapi.example.temu.com/');
    });

    it('carries the signed envelope', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: {} });

      await probe().callWith('some.method');

      const body = lastBody();
      expect(body).toMatchObject({
        type: 'some.method',
        app_key: 'app-key',
        access_token: 'token-1',
        data_type: 'JSON',
      });
      expect(body.sign).toMatch(/^[0-9A-F]{32}$/);
    });

    it('never puts the app secret on the wire', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: {} });

      await probe().callWith('some.method');

      expect(lastCall()[1].body).not.toContain('app-secret');
    });

    it('treats success:false as a failure even though the HTTP call succeeded', async () => {
      // Temu answers 200 for business failures; trusting the status code is how
      // a sync silently imports nothing.
      httpClient.request.mockResolvedValue({
        success: false,
        errorCode: 4000,
        errorMsg: 'invalid signature',
      });

      await expect(probe().callWith('some.method')).rejects.toThrow(/invalid signature.*4000/s);
    });

    it('gives each gateway its own throttling bucket', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: {} });

      await probe().callWith('some.method');
      await probe({ ...CREDENTIALS, apiUrl: 'https://openapi-eu.example.temu.com' }).callWith('m');

      expect(new Set(rateLimiter.throttle.mock.calls.map((c) => c[0])).size).toBe(2);
    });
  });
});
