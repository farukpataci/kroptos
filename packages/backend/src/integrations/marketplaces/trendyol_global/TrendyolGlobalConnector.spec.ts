import { TrendyolGlobalConnector } from './TrendyolGlobalConnector';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * These pin the request shape and the country handling. They are NOT proof the
 * international endpoints exist or that the storefront codes are the right
 * ones — a mock answers whatever it is told. Live verification against a real
 * international seller account is still outstanding.
 */
describe('TrendyolGlobalConnector', () => {
  const CREDENTIALS = { sellerId: '123456', apiKey: 'key-abc', apiSecret: 'secret-xyz', country: 'RO' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (credentials = CREDENTIALS, settings: Record<string, unknown> = {}) =>
    new TrendyolGlobalConnector(
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

  describe('country handling', () => {
    it('refuses to construct without a country', () => {
      const { country, ...noCountry } = CREDENTIALS;
      expect(() => build(noCountry as any)).toThrow(/ülke seçilmedi/i);
    });

    it('refuses an unsupported country instead of calling the gateway', () => {
      expect(() => build({ ...CREDENTIALS, country: 'ZZ' })).toThrow(/desteklenmeyen ülke/i);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('rejects the codes that were removed as unverified', () => {
      for (const code of ['INT', 'AZ', 'DE', 'GB']) {
        expect(() => build({ ...CREDENTIALS, country: code })).toThrow(/desteklenmeyen ülke/i);
      }
    });

    it('accepts a lower-case country and normalises it', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build({ ...CREDENTIALS, country: 'ro' }).getProducts();

      expect(lastCall()[1].headers.storeFrontCode).toBe('RO');
    });
  });

  describe('storefront scoping', () => {
    it('sends the country as the storeFrontCode header, not in the query', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build().getProducts();

      const [url, options] = lastCall();
      expect(options.headers.storeFrontCode).toBe('RO');
      expect(url).not.toContain('storeFrontCode');
    });

    it('scopes the category tree to the country too', async () => {
      httpClient.request.mockResolvedValue({ categories: [{ id: 1 }] });

      await build({ ...CREDENTIALS, country: 'GR' }).getCategories();

      expect(lastCall()[1].headers.storeFrontCode).toBe('GR');
    });

    it('uses the same gateway host as the Türkiye connector', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build().getProducts();

      expect(lastCall()[0]).toContain('https://apigw.trendyol.com');
    });

    it('names the country in the connection test message', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalElements: 2, totalPages: 1 });

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Romanya');
    });
  });

  describe('rate limiting', () => {
    it('gives each country its own throttling bucket', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build({ ...CREDENTIALS, country: 'RO' }).getProducts();
      await build({ ...CREDENTIALS, country: 'GR' }).getProducts();

      const keys = rateLimiter.throttle.mock.calls.map((call) => call[0]);
      expect(keys).toContain('TRENDYOL_GLOBAL:RO');
      expect(keys).toContain('TRENDYOL_GLOBAL:GR');
    });
  });

  describe('currency and address', () => {
    const order = (currencyCode?: string) => ({
      id: 1,
      orderNumber: 'TYG-1',
      status: 'Created',
      customerFirstName: 'Ana',
      customerLastName: 'Popescu',
      totalPrice: 100,
      ...(currencyCode ? { currencyCode } : {}),
      shipmentAddress: { address1: 'Str 1', city: 'Bucuresti' },
      lines: [{ barcode: '1', merchantSku: 'SKU-1', quantity: 1, price: 100, productName: 'X' }],
    });

    it('keeps the currency the marketplace sent', async () => {
      httpClient.request.mockResolvedValue({ content: [order('RON')], totalPages: 1 });

      const [unified] = await build().getOrders();

      expect(unified.currency).toBe('RON');
    });

    it('does not invent TRY when the payload omits the currency', async () => {
      // Guessing a currency would silently mislabel money; the per-storefront
      // currency table is unverified, so nothing is substituted.
      httpClient.request.mockResolvedValue({ content: [order()], totalPages: 1 });

      const [unified] = await build().getOrders();

      expect(unified.currency).not.toBe('TRY');
    });

    it('stamps the storefront country on an address that omits one', async () => {
      httpClient.request.mockResolvedValue({ content: [order('RON')], totalPages: 1 });

      const [unified] = await build().getOrders();

      expect(unified.shippingAddress).toContain('Bucuresti');
    });
  });
});
