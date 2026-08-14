import { HttpStatus } from '@nestjs/common';
import { AllegroConnector } from './AllegroConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * These pin the request shape, the token rotation and the SKU→offer mapping.
 * They are NOT proof the endpoints behave as assumed — a mock answers whatever
 * it is told. Live verification against a real Allegro account is outstanding.
 */
describe('AllegroConnector', () => {
  const CREDENTIALS = { clientId: 'client-1', clientSecret: 'secret-1', refreshToken: 'refresh-1' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (credentials = CREDENTIALS, settings: Record<string, unknown> = {}) =>
    new AllegroConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const calls = () => httpClient.request.mock.calls;
  const lastCall = () => calls()[calls().length - 1];
  const tokenCall = () => calls().find((c) => String(c[0]).includes('/auth/oauth/token'));

  const mockTokenThen = (payload: unknown, token: Record<string, unknown> = {}) => {
    httpClient.request
      .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 43200, ...token })
      .mockResolvedValue(payload);
  };

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('OAuth', () => {
    it('refreshes on the auth host, which is not the API host', async () => {
      mockTokenThen({ checkoutForms: [], totalCount: 0 });

      await build().testConnection();

      expect(tokenCall()![0]).toBe('https://allegro.pl/auth/oauth/token');
      expect(lastCall()[0]).toContain('https://api.allegro.pl');
    });

    it('sends the refresh grant with Basic app credentials, form encoded', async () => {
      mockTokenThen({ checkoutForms: [] });

      await build().testConnection();

      const [, options] = tokenCall()!;
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(options.headers.Authorization).toBe(
        `Basic ${Buffer.from('client-1:secret-1').toString('base64')}`,
      );
      expect(options.body).toContain('grant_type=refresh_token');
      expect(options.body).toContain('refresh_token=refresh-1');
    });

    it('names the versioned media type Allegro requires', async () => {
      mockTokenThen({ checkoutForms: [] });

      await build().testConnection();

      expect(lastCall()[1].headers.Accept).toBe('application/vnd.allegro.public.v1+json');
    });

    it('switches both hosts together in sandbox', async () => {
      mockTokenThen({ checkoutForms: [] });

      await build(CREDENTIALS, { 'general.environment': 'sandbox' }).testConnection();

      expect(tokenCall()![0]).toBe('https://allegro.pl.allegrosandbox.pl/auth/oauth/token');
      expect(lastCall()[0]).toContain('https://api.allegro.pl.allegrosandbox.pl');
    });

    it('reuses the access token instead of refreshing on every call', async () => {
      mockTokenThen({ checkoutForms: [] });

      const connector = build();
      await connector.getOrders();
      await connector.getOrders();

      expect(calls().filter((c) => String(c[0]).includes('/auth/oauth/token'))).toHaveLength(1);
    });

    it('explains an expired refresh token instead of leaking the status', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 400),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/refresh token/i);
      expect(result.message).toMatch(/3 ay/);
    });
  });

  describe('refresh token rotation', () => {
    // Allegro rotates on every exchange and the old token dies within about a
    // minute, so failing to persist the new one breaks the integration for good.
    it('reports the replacement token so the caller can persist it', async () => {
      mockTokenThen({ checkoutForms: [] }, { refresh_token: 'refresh-2' });

      const connector = build();
      await connector.testConnection();

      expect(connector.consumeRotatedCredentials()).toEqual({ refreshToken: 'refresh-2' });
    });

    it('does not report a rotation when the same token comes back', async () => {
      mockTokenThen({ checkoutForms: [] }, { refresh_token: 'refresh-1' });

      const connector = build();
      await connector.testConnection();

      expect(connector.consumeRotatedCredentials()).toBeUndefined();
    });

    it('uses the rotated token on a later refresh, not the pasted one', async () => {
      httpClient.request
        .mockResolvedValueOnce({ access_token: 'a1', expires_in: -1, refresh_token: 'refresh-2' })
        .mockResolvedValueOnce({ checkoutForms: [] })
        .mockResolvedValueOnce({ access_token: 'a2', expires_in: 43200, refresh_token: 'refresh-3' })
        .mockResolvedValue({ checkoutForms: [] });

      const connector = build();
      await connector.getOrders();
      await connector.getOrders();

      const refreshes = calls().filter((c) => String(c[0]).includes('/auth/oauth/token'));
      expect(refreshes).toHaveLength(2);
      expect(refreshes[1][1].body).toContain('refresh_token=refresh-2');
    });
  });

  describe('getOrders', () => {
    const form = {
      id: 'CF-1',
      status: 'READY_FOR_PROCESSING',
      summary: { totalToPay: { amount: '129.99', currency: 'PLN' } },
      buyer: { firstName: 'Ada', lastName: 'Kowalska', email: 'a@example.com' },
      delivery: { address: { street: 'ul. Główna 1', city: 'Warszawa', countryCode: 'PL' } },
      lineItems: [
        { offer: { id: '99', name: 'Sukienka', external: { id: 'SKU-1' } }, quantity: 2, price: { amount: '64.99' } },
      ],
    };

    it('reads Allegro amounts as decimal text in major units', async () => {
      mockTokenThen({ checkoutForms: [form] });

      const [unified] = await build().getOrders();

      expect(unified.totalAmount).toBe(129.99);
      expect(unified.items[0].unitPrice).toBe(64.99);
    });

    it('prefers the seller external id over Allegro own offer id as the SKU', async () => {
      mockTokenThen({ checkoutForms: [form] });

      expect((await build().getOrders())[0].items[0].sku).toBe('SKU-1');
    });

    it('maps a checkout form onto the shared order shape', async () => {
      mockTokenThen({ checkoutForms: [form] });

      expect((await build().getOrders())[0]).toMatchObject({
        orderNumber: 'CF-1',
        customerName: 'Ada Kowalska',
        status: 'processing',
        currency: 'PLN',
        source: 'allegro',
      });
    });

    it('leaves an unknown status as pending instead of guessing', async () => {
      mockTokenThen({ checkoutForms: [{ ...form, status: 'SOMETHING_NEW' }] });

      expect((await build().getOrders())[0].status).toBe('pending');
    });

    it('does not invent a currency when the payload omits one', async () => {
      mockTokenThen({ checkoutForms: [{ ...form, summary: { totalToPay: { amount: '5' } } }] });

      expect((await build().getOrders())[0].currency).toBe('');
    });
  });

  describe('updateStock', () => {
    const offers = {
      offers: [
        { id: 'OFFER-9', name: 'Sukienka', external: { id: 'SKU-1' }, stock: { available: 3 } },
      ],
    };

    it('resolves the SKU to an offer id and patches that offer', async () => {
      httpClient.request
        .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 43200 })
        .mockResolvedValueOnce(offers)
        .mockResolvedValue({});

      const result = await build().updateStock('SKU-1', 12);

      expect(result).toEqual({ sku: 'SKU-1', quantity: 12, success: true });
      const [url, options] = lastCall();
      expect(url).toContain('/sale/product-offers/OFFER-9');
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body)).toEqual({ stock: { available: 12 } });
    });

    it('builds the offer index once rather than per SKU', async () => {
      httpClient.request
        .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 43200 })
        .mockResolvedValueOnce(offers)
        .mockResolvedValue({});

      const connector = build();
      await connector.updateStock('SKU-1', 1);
      await connector.updateStock('SKU-1', 2);

      expect(calls().filter((c) => String(c[0]).includes('/sale/offers'))).toHaveLength(1);
    });

    it('reports a SKU with no matching offer rather than failing silently', async () => {
      httpClient.request
        .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 43200 })
        .mockResolvedValue({ offers: [] });

      const result = await build().updateStock('MISSING', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('MISSING');
    });

    it('reports failure instead of throwing so one SKU cannot abort a sync', async () => {
      httpClient.request
        .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 43200 })
        .mockResolvedValueOnce(offers)
        .mockRejectedValue(new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 403));

      const result = await build().updateStock('SKU-1', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('getProducts', () => {
    it('maps offers onto the shared product shape', async () => {
      mockTokenThen({
        offers: [
          {
            id: 'OFFER-9',
            name: 'Sukienka',
            external: { id: 'SKU-1' },
            sellingMode: { price: { amount: '64.99', currency: 'PLN' } },
            stock: { available: 3 },
            primaryImage: { url: 'http://img' },
            ean: '590123',
          },
        ],
      });

      expect((await build().getProducts())[0]).toMatchObject({
        sku: 'SKU-1',
        name: 'Sukienka',
        price: 64.99,
        stockQuantity: 3,
        image: 'http://img',
        barcode: '590123',
      });
    });
  });

  describe('categories', () => {
    it('surfaces a failure rather than substituting a fake tree', async () => {
      httpClient.request
        .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 43200 })
        .mockRejectedValue(new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 500));

      await expect(build().getCategories()).rejects.toThrow();
    });
  });
});
