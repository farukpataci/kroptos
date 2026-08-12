import { HttpStatus } from '@nestjs/common';
import { ZalandoConnector } from './ZalandoConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * The authentication half is pinned against Zalando's published Authentication
 * OpenAPI spec, so those cases describe real behaviour. The business half is
 * unconfirmed, and the refusal cases exist so that gap fails loudly rather than
 * silently syncing nothing.
 */
describe('ZalandoConnector', () => {
  const CREDENTIALS = { clientId: 'client-1', clientSecret: 'secret-1', merchantId: 'merchant-9' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (credentials = CREDENTIALS, settings: Record<string, unknown> = {}) =>
    new ZalandoConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const calls = () => httpClient.request.mock.calls;
  const lastCall = () => calls()[calls().length - 1];
  const tokenCall = () => calls().find((c) => String(c[0]).includes('/auth/token'));

  const mockTokenThen = (payload: unknown) => {
    httpClient.request
      .mockResolvedValueOnce({ access_token: 'access-1', token_type: 'Bearer', expires_in: 3600 })
      .mockResolvedValue(payload);
  };

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('OAuth2 client credentials', () => {
    it('posts the client-credentials grant to the documented token path', async () => {
      mockTokenThen({ merchant_id: 'merchant-9', scopes: [] });

      await build().testConnection();

      const [url, options] = tokenCall()!;
      expect(url).toBe('https://api.merchants.zalando.com/auth/token');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(options.body).toContain('grant_type=client_credentials');
    });

    it('authenticates the token call with Basic, not the bearer', async () => {
      mockTokenThen({ scopes: [] });

      await build().testConnection();

      expect(tokenCall()![1].headers.Authorization).toBe(
        `Basic ${Buffer.from('client-1:secret-1').toString('base64')}`,
      );
    });

    it('sends the access token as a bearer on the business call', async () => {
      mockTokenThen({ scopes: [] });

      await build().testConnection();

      expect(lastCall()[1].headers.Authorization).toBe('Bearer access-1');
    });

    it('reuses the token instead of exchanging on every call', async () => {
      mockTokenThen({ scopes: [] });

      const connector = build();
      await connector.testConnection();
      await connector.testConnection();

      expect(calls().filter((c) => String(c[0]).includes('/auth/token'))).toHaveLength(1);
    });

    it('targets the sandbox host when the environment says so', async () => {
      mockTokenThen({ scopes: [] });

      await build(CREDENTIALS, { 'general.environment': 'sandbox' }).testConnection();

      expect(tokenCall()![0]).toBe('https://api-sandbox.merchants.zalando.com/auth/token');
    });

    it('mentions sandbox mode when the token exchange fails', async () => {
      // New zDirect apps default to sandbox, which is the most common reason a
      // correct-looking client id fails against production.
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 401),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/sandbox/i);
    });

    it('separates throttling per environment and merchant', async () => {
      mockTokenThen({ scopes: [] });

      await build().testConnection();
      await build(CREDENTIALS, { 'general.environment': 'sandbox' }).testConnection();
      await build({ ...CREDENTIALS, merchantId: 'merchant-2' }).testConnection();

      expect(new Set(rateLimiter.throttle.mock.calls.map((c) => c[0])).size).toBe(3);
    });
  });

  describe('testConnection', () => {
    it('proves the credentials through the identity endpoint', async () => {
      mockTokenThen({ merchant_id: 'merchant-9', scopes: ['orders.read', 'stock.write'] });

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      expect(lastCall()[0]).toBe('https://api.merchants.zalando.com/auth/me');
      expect(result.message).toContain('merchant-9');
      expect(result.message).toContain('2');
    });

    it('does not depend on any unconfirmed business path', async () => {
      mockTokenThen({ scopes: [] });

      await build().testConnection();

      // Only the token and identity calls — both verified against the spec.
      expect(calls().map((c) => String(c[0]))).toEqual([
        'https://api.merchants.zalando.com/auth/token',
        'https://api.merchants.zalando.com/auth/me',
      ]);
    });
  });

  describe('getOrders', () => {
    const order = {
      order_number: 'ZL-1',
      status: 'shipped',
      gross_total: { amount: 49.9, currency: 'EUR' },
      delivery_address: { first_name: 'Ada', last_name: 'Lovelace', city: 'Berlin', country_code: 'DE' },
      items: [{ merchant_sku: 'SKU-1', name: 'Dress', quantity: 2, price: { amount: 24.95 } }],
    };

    it('requires the merchant id, which is a path parameter', async () => {
      const { merchantId, ...without } = CREDENTIALS;
      mockTokenThen({ items: [] });

      await expect(build(without as any).getOrders()).rejects.toThrow(/merchantId/);
    });

    it('maps a Zalando order onto the shared shape', async () => {
      mockTokenThen({ items: [order] });

      const [unified] = await build().getOrders();

      expect(unified).toMatchObject({
        orderNumber: 'ZL-1',
        customerName: 'Ada Lovelace',
        status: 'shipped',
        totalAmount: 49.9,
        currency: 'EUR',
        source: 'zalando',
      });
      expect(unified.items).toEqual([
        { sku: 'SKU-1', name: 'Dress', quantity: 2, unitPrice: 24.95, totalPrice: 49.9 },
      ]);
    });

    it('reads amounts as major units rather than cents', async () => {
      // The opposite of Temu, and the most damaging thing here to get wrong.
      mockTokenThen({ items: [order] });

      expect((await build().getOrders())[0].totalAmount).toBe(49.9);
    });

    it('does not invent a currency when the payload omits one', async () => {
      mockTokenThen({ items: [{ ...order, gross_total: { amount: 10 }, currency: undefined }] });

      expect((await build().getOrders())[0].currency).toBe('');
    });

    it('leaves an unknown status as pending instead of guessing', async () => {
      mockTokenThen({ items: [{ ...order, status: 'SOMETHING_NEW' }] });

      expect((await build().getOrders())[0].status).toBe('pending');
    });
  });

  describe('operations whose path was never confirmed', () => {
    it('refuses getProducts and names the constant to fill in', async () => {
      await expect(build().getProducts()).rejects.toThrow(/UNCONFIRMED_PATHS\.products/);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('refuses getCategories and names the constant to fill in', async () => {
      await expect(build().getCategories()).rejects.toThrow(/UNCONFIRMED_PATHS\.categories/);
    });

    it('warns about the two Zalando models in the refusal', async () => {
      // zDirect and Connected Retail are different products with different
      // protocols; picking the wrong one is the expensive mistake here.
      await expect(build().getProducts()).rejects.toThrow(/Connected Retail/);
    });

    it('reports stock as failed rather than throwing, so one SKU cannot abort a sync', async () => {
      const result = await build().updateStock('SKU-1', 5);

      expect(result).toMatchObject({ sku: 'SKU-1', quantity: 5, success: false });
      expect(result.error).toMatch(/UNCONFIRMED_PATHS\.stock/);
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });
});
