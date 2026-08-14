import { TemuConnector } from './TemuConnector';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * The operation names are established and the connector now makes real calls.
 * The RESPONSE shapes are not established, so the tests that matter most here
 * are the ones pinning what happens when a payload does not look the way this
 * code expects — that path decides whether a wrong assumption shows up as a
 * loud failure or as a sync that quietly imports nothing.
 */
describe('TemuConnector', () => {
  const CREDENTIALS = {
    apiUrl: 'https://openapi-b-us.temu.com/openapi/router',
    appKey: 'app-key',
    appSecret: 'app-secret',
    accessToken: 'token-1',
  };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (credentials: Record<string, any> = CREDENTIALS, settings: Record<string, unknown> = {}) =>
    new TemuConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const lastCall = () => httpClient.request.mock.calls[httpClient.request.mock.calls.length - 1];
  const lastBody = () => JSON.parse(lastCall()[1].body);
  const bodyOf = (index: number) => JSON.parse(httpClient.request.mock.calls[index][1].body);

  /** One page of `size` rows, so pagination can be driven without 50 literals. */
  const page = (size: number, make: (index: number) => unknown = (i) => ({ parentOrderSn: `SN-${i}` })) => ({
    success: true,
    result: { pageItems: Array.from({ length: size }, (_, i) => make(i)) },
  });

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('gateway', () => {
    it('posts to the router path on the host the seller supplied', async () => {
      httpClient.request.mockResolvedValue(page(0));

      await build().testConnection();

      const [url, options] = lastCall();
      expect(url).toBe('https://openapi-b-us.temu.com/openapi/router');
      expect(options.method).toBe('POST');
    });

    it('appends the router path when the seller pasted a bare host', async () => {
      // Posting to `/` returns an HTML error page rather than the envelope, so a
      // bare host used to fail in a way that looked like bad credentials.
      httpClient.request.mockResolvedValue(page(0));

      await build({ ...CREDENTIALS, apiUrl: 'openapi-b-us.temu.com' }).testConnection();

      expect(lastCall()[0]).toBe('https://openapi-b-us.temu.com/openapi/router');
    });

    it('leaves a pasted path alone rather than assuming ours is the right one', async () => {
      httpClient.request.mockResolvedValue(page(0));

      await build({ ...CREDENTIALS, apiUrl: 'https://openapi-b-eu.temu.com/custom/router' }).testConnection();

      expect(lastCall()[0]).toBe('https://openapi-b-eu.temu.com/custom/router');
    });

    it('gives each gateway its own throttling bucket', async () => {
      httpClient.request.mockResolvedValue(page(0));

      await build().testConnection();
      await build({ ...CREDENTIALS, apiUrl: 'https://openapi-b-eu.temu.com/openapi/router' }).testConnection();

      expect(new Set(rateLimiter.throttle.mock.calls.map((c) => c[0])).size).toBe(2);
    });
  });

  describe('transport', () => {
    it('carries the signed envelope', async () => {
      httpClient.request.mockResolvedValue(page(0));

      await build().testConnection();

      expect(lastBody()).toMatchObject({
        type: 'bg.order.list.v2.get',
        app_key: 'app-key',
        access_token: 'token-1',
        data_type: 'JSON',
      });
      expect(lastBody().sign).toMatch(/^[0-9A-F]{32}$/);
    });

    it('never puts the app secret on the wire', async () => {
      httpClient.request.mockResolvedValue(page(0));

      await build().testConnection();

      expect(lastCall()[1].body).not.toContain('app-secret');
    });

    it('treats success:false as a failure even though the HTTP call succeeded', async () => {
      // Temu answers 200 for business failures; trusting the status code is how
      // a sync silently imports nothing.
      httpClient.request.mockResolvedValue({ success: false, errorCode: 4000, errorMsg: 'invalid signature' });

      await expect(build().getOrders()).rejects.toThrow(/invalid signature.*4000/s);
    });
  });

  describe('testConnection', () => {
    it('succeeds by making one real, cheapest-possible call', async () => {
      httpClient.request.mockResolvedValue(page(0));

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      expect(lastBody()).toMatchObject({ page_number: 1, page_size: 1 });
    });

    it('reports a missing credential before contacting Temu', async () => {
      const { appSecret, ...without } = CREDENTIALS;

      const result = await build(without).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('appSecret');
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('reports a malformed gateway before contacting Temu', async () => {
      const result = await build({ ...CREDENTIALS, apiUrl: 'http://' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/geçerli bir URL değil/i);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('surfaces Temu\'s own rejection rather than reporting a connection problem', async () => {
      httpClient.request.mockResolvedValue({ success: false, errorCode: 2000, errorMsg: 'access token expired' });

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/access token expired/);
    });
  });

  describe('pagination', () => {
    it('pages orders with page_number until a short page arrives', async () => {
      httpClient.request.mockResolvedValueOnce(page(50)).mockResolvedValueOnce(page(3));

      const orders = await build().getOrders();

      expect(orders).toHaveLength(53);
      expect(bodyOf(0)).toMatchObject({ page_number: 1, page_size: 50 });
      expect(bodyOf(1)).toMatchObject({ page_number: 2 });
    });

    it('pages goods with page_no, which is NOT the field orders use', async () => {
      // The two families spell pagination differently; sending the wrong one
      // returns page 1 forever and the sync looks like it works.
      httpClient.request.mockResolvedValue(page(0));

      await build().getProducts();

      const body = lastBody();
      expect(body).toMatchObject({ type: 'bg.local.goods.sku.list.query', page_no: 1 });
      expect(body.page_number).toBeUndefined();
    });

    it('stops at the page cap instead of looping on a mis-read response', async () => {
      httpClient.request.mockResolvedValue(page(50));

      await build().getOrders();

      expect(httpClient.request).toHaveBeenCalledTimes(20);
    });
  });

  describe('unrecognised response shape', () => {
    it('refuses and names the keys it actually received', async () => {
      // Returning [] here would report "no orders" for what is really a parsing
      // failure, and that can go unnoticed for weeks.
      httpClient.request.mockResolvedValue({ success: true, result: { orderRows: [], total: 0 } });

      await expect(build().getOrders()).rejects.toThrow(/orderRows, total/);
    });

    it('accepts a bare array as the page', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: [{ parentOrderSn: 'SN-1' }] });

      await expect(build().getOrders()).resolves.toHaveLength(1);
    });
  });

  describe('operations without a verified request shape', () => {
    it('reports stock as failed rather than guessing the list element keys', async () => {
      const result = await build().updateStock('SKU-1', 5);

      expect(result).toMatchObject({ sku: 'SKU-1', quantity: 5, success: false });
      // The method name is known; the element shape is what is missing, and the
      // message has to say so or the next reader will "fix" the wrong thing.
      expect(result.error).toMatch(/bg\.local\.goods\.stock\.edit/);
      expect(result.error).toMatch(/sku_stock_change_list/);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('refuses category attributes, naming the candidate method', async () => {
      await expect(build().getCategoryAttributes('123')).rejects.toThrow(/bg\.local\.goods\.property\.get/);
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });

  describe('categories', () => {
    it('asks for the root of the tree', async () => {
      httpClient.request.mockResolvedValue({ success: true, result: { pageItems: [{ catId: 1 }] } });

      const categories = await build().getCategories();

      expect(categories).toHaveLength(1);
      expect(lastBody()).toMatchObject({ type: 'bg.local.goods.cats.get', parent_cat_id: 0 });
    });
  });
});
