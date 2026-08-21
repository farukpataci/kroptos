import { HttpStatus } from '@nestjs/common';
import { TrendyolConnector } from './TrendyolConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * These tests pin the request shape (URL, auth header, paging) and the error
 * mapping. They are NOT proof that the endpoints exist: a mock answers whatever
 * it is told to, in the right shape or the wrong one. Live verification against
 * a real seller account is still outstanding.
 */
describe('TrendyolConnector', () => {
  const CREDENTIALS = { sellerId: '123456', apiKey: 'key-abc', apiSecret: 'secret-xyz' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new TrendyolConnector(
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

  describe('authentication', () => {
    it('should send Basic auth and the seller-scoped User-Agent', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalElements: 7, totalPages: 1 });

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      const [url, options] = lastCall();
      expect(url).toContain('https://apigw.trendyol.com/integration/product/sellers/123456/products');
      expect(options.headers.Authorization).toBe(
        `Basic ${Buffer.from('key-abc:secret-xyz').toString('base64')}`,
      );
      expect(options.headers['User-Agent']).toBe('123456 - SelfIntegration');
    });

    it('should target the stage gateway when the environment is sandbox', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build({ 'general.environment': 'sandbox' }).getProducts();

      expect(lastCall()[0]).toContain('https://stageapigw.trendyol.com');
    });

    // Trendyol documents storeFrontCode as a header parameter. It used to be
    // appended to the query string, where the gateway ignores it — so every
    // call silently ran against the account's default storefront.
    //
    // The value is the ISO country code. A numeric storefront id ('1') is
    // accepted by the products endpoint but 400s on orders and
    // product-categories, which is how it survived a green connection test.
    it('should send the storefront as a header, never in the query string', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build().getProducts();

      const [url, options] = lastCall();
      expect(options.headers.storeFrontCode).toBe('TR');
      expect(url).not.toContain('storeFrontCode');
    });

    it('should scope orders, products and categories to Türkiye', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1, categories: [] });

      const connector = build();
      await connector.getProducts();
      expect(lastCall()[1].headers.storeFrontCode).toBe('TR');

      await connector.getOrders();
      expect(lastCall()[1].headers.storeFrontCode).toBe('TR');

      await connector.getCategories();
      expect(lastCall()[1].headers.storeFrontCode).toBe('TR');
    });

    // This provider is Türkiye. Anything international is `trendyol_global`,
    // which is a separate integration record with its own country.
    it('should ignore a leftover storefront setting instead of switching country', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build({ 'trendyol.marketplace': 'de' }).getProducts();

      expect(lastCall()[1].headers.storeFrontCode).toBe('TR');
    });

    it('should say Türkiye in the connection test message', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalElements: 4, totalPages: 1 });

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Türkiye');
    });

    it('should fail before any request when a credential field is empty', async () => {
      const result = await build({}, { sellerId: '123456', apiKey: '', apiSecret: 'x' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('apiKey');
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });

  describe('testConnection error mapping', () => {
    it('should explain a 401 instead of leaking the raw status', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 401, '{"errors":["unauthorized"]}'),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('kimlik doğrulaması reddedildi');
      expect(result.message).toContain('401');
    });

    it('should point at the rate limit setting on a 429', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 429),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('advanced.rateLimitPerMinute');
    });

    // A 400 is a validation answer and the body names the rejected field. It
    // used to be dropped, leaving the UI with a bare "status 400" — which is
    // how the wrong storefrontCode value survived a green connection test.
    it('should carry the upstream body through on a 400', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError(
          'Marketplace HTTP Request failed with status 400: Bad Request',
          HttpStatus.BAD_GATEWAY,
          400,
          '{"exception":"ValidationException","errors":[{"key":"storeFrontCode","message":"invalid storefrontCode"}]}',
        ),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid storefrontCode');
    });

    // The stage gateway answers every path with Cloudflare's block page, so an
    // HTML body means the request never reached Trendyol. Saying that beats
    // pasting 300 characters of markup into the seller's screen.
    it('should say a gateway blocked the request when the body is HTML', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError(
          'failed',
          HttpStatus.BAD_GATEWAY,
          403,
          '<!DOCTYPE html><html><head><title>Attention Required! | Cloudflare</title></head>',
        ),
      );

      const result = await build({ 'general.environment': 'sandbox' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('engellendi');
      expect(result.message).not.toContain('DOCTYPE');
    });
  });

  describe('getOrders', () => {
    const order = (orderNumber: string, status: string) => ({
      id: 1,
      orderNumber,
      status,
      customerFirstName: 'Ada',
      customerLastName: 'Lovelace',
      totalPrice: 100,
      currencyCode: 'TRY',
      shipmentAddress: { address1: 'Sokak 1', city: 'İstanbul', countryCode: 'TR' },
      lines: [{ barcode: '869', merchantSku: 'SKU-1', quantity: 2, price: 50, productName: 'Ürün' }],
    });

    it('should walk every page and merge the results', async () => {
      httpClient.request
        .mockResolvedValueOnce({ content: [order('TY-1', 'Created')], totalPages: 2 })
        .mockResolvedValueOnce({ content: [order('TY-2', 'Created')], totalPages: 2 });

      const orders = await build().getOrders();

      expect(httpClient.request).toHaveBeenCalledTimes(2);
      expect(orders.map((o) => o.orderNumber)).toEqual(['TY-1', 'TY-2']);
      expect(lastCall()[0]).toContain('page=1');
      expect(lastCall()[0]).toContain('size=200');
    });

    it('should keep only the statuses selected in settings', async () => {
      httpClient.request.mockResolvedValue({
        content: [order('TY-1', 'Created'), order('TY-2', 'Cancelled')],
        totalPages: 1,
      });

      const orders = await build({ 'orders.importStatuses': ['created'] }).getOrders();

      expect(orders.map((o) => o.orderNumber)).toEqual(['TY-1']);
    });

    it('should derive the start date from orders.backfillDays', async () => {
      httpClient.request.mockResolvedValue({ content: [], totalPages: 1 });

      await build({ 'orders.backfillDays': 3 }).getOrders();

      const url = new URL(lastCall()[0]);
      const startDate = Number(url.searchParams.get('startDate'));
      const expected = Date.now() - 3 * 24 * 60 * 60 * 1000;
      expect(Math.abs(startDate - expected)).toBeLessThan(10_000);
    });

    it('should map a Trendyol line onto the unified order shape', async () => {
      httpClient.request.mockResolvedValue({ content: [order('TY-9', 'Created')], totalPages: 1 });

      const [unified] = await build().getOrders();

      expect(unified).toMatchObject({
        orderNumber: 'TY-9',
        customerName: 'Ada Lovelace',
        status: 'pending',
        source: 'trendyol',
        currency: 'TRY',
      });
      expect(unified.items).toEqual([
        { sku: 'SKU-1', name: 'Ürün', quantity: 2, unitPrice: 50, totalPrice: 100 },
      ]);
    });

    // Both settings were offered in the UI and read by nobody: the seller saw
    // them saved and they changed nothing.
    it("should apply the seller's orders.statusMap over the built-in table", async () => {
      httpClient.request.mockResolvedValue({
        content: [order('TY-1', 'Picking'), order('TY-2', 'Created')],
        totalPages: 1,
      });

      const orders = await build({
        'orders.importStatuses': ['created', 'picking'],
        'orders.statusMap': { picking: 'processing' },
      }).getOrders();

      // The seller's row wins over the built-in table; 'Created' has no row
      // and keeps the built-in mapping.
      expect(orders.map((o) => o.status)).toEqual(['processing', 'pending']);
    });

    it('should ignore a status the rest of the system does not know', async () => {
      httpClient.request.mockResolvedValue({ content: [order('TY-1', 'Created')], totalPages: 1 });

      const [unified] = await build({ 'orders.statusMap': { created: 'made-up' } }).getOrders();

      expect(unified.status).toBe('pending');
    });

    // ------------------------------------------------------------------
    // The fixture below is a real gateway response, trimmed. The one above it
    // was written from documentation and uses field names the gateway does not
    // send (`price`, `totalPrice`), which is exactly why every imported order
    // used to arrive at zero: the fallbacks kept the mock happy and read
    // nothing from the real payload.
    // ------------------------------------------------------------------
    const livePackage = (orderNumber: string, shipmentPackageId: number, status: string) => ({
      orderNumber,
      shipmentPackageId,
      status,
      shipmentPackageStatus: status,
      customerFirstName: 'TY',
      customerLastName: 'Demir Cargo',
      customerEmail: 'pf+dbn98bnm@trendyolmail.com',
      currencyCode: 'TRY',
      packageGrossAmount: 1998.0,
      packageTotalPrice: 1898.0,
      packageTotalDiscount: 100.0,
      shipmentAddress: { address1: 'Güzelyurt Mah. 2137. Sk.', city: 'İstanbul', countryCode: 'TR', phone: '5111111111' },
      lines: [
        {
          quantity: 2,
          stockCode: 'KZK-BLUE-S',
          barcode: 'KZK-BLUE-S',
          productName: 'agr test',
          sellerId: 2738,
          lineUnitPrice: 999.0,
          lineGrossAmount: 1998.0,
          lineTotalDiscount: 100.0,
          currencyCode: 'TRY',
        },
      ],
    });

    it('should read the amounts the live gateway actually sends', async () => {
      httpClient.request.mockResolvedValue({
        content: [livePackage('1798679650', 92015118, 'Picking')],
        totalPages: 1,
      });

      const [unified] = await build().getOrders();

      // packageTotalPrice, not the absent `totalPrice`.
      expect(unified.totalAmount).toBe(1898);
      expect(unified.items).toEqual([
        {
          sku: 'KZK-BLUE-S',
          name: 'agr test',
          quantity: 2,
          // lineUnitPrice, not the absent `price`.
          unitPrice: 999,
          totalPrice: 999 * 2 - 100,
        },
      ]);
    });

    // Trendyol splits one order across packages that ship and cancel on their
    // own. Stored under the bare order number they collide on the unique
    // constraint and only the first one survives the import.
    it('should key each shipment package separately and keep the seller-facing number', async () => {
      httpClient.request.mockResolvedValue({
        content: [
          livePackage('791395587', 92311593, 'Picking'),
          livePackage('791395587', 92311594, 'Picking'),
        ],
        totalPages: 1,
      });

      const orders = await build({ 'orders.importStatuses': ['picking'] }).getOrders();

      expect(orders.map((o) => o.orderNumber)).toEqual(['791395587-92311593', '791395587-92311594']);
      expect(orders.map((o) => o.marketplaceOrderNumber)).toEqual(['791395587', '791395587']);
    });

    // Picking, UnPacked, Invoiced and Returned were every status the mapper's
    // four-branch table did not know, so they all became 'pending'.
    it.each([
      ['Picking', 'processing'],
      ['UnPacked', 'processing'],
      ['Invoiced', 'processing'],
      ['Returned', 'returned'],
      ['Delivered', 'delivered'],
      ['Cancelled', 'cancelled'],
    ])('should map the %s package status onto %s', async (trendyolStatus, expected) => {
      httpClient.request.mockResolvedValue({
        content: [livePackage('TY-1', 1, trendyolStatus)],
        totalPages: 1,
      });

      const [unified] = await build({ 'orders.importStatuses': [] }).getOrders();

      expect(unified.status).toBe(expected);
    });

    it('should prefix imported order numbers with orders.numberPrefix', async () => {
      httpClient.request.mockResolvedValue({ content: [order('65530680', 'Created')], totalPages: 1 });

      const [unified] = await build({ 'orders.numberPrefix': 'TY-' }).getOrders();

      expect(unified.orderNumber).toBe('TY-65530680');
    });
  });

  describe('updateStock', () => {
    /**
     * Two calls, not one. The POST only queues the change and answers with an
     * id; the batch result is a second request. Treating the POST as success is
     * what let a rejected item look applied.
     *
     * `stockConfirmDelayMs: 0` keeps these tests off the real clock.
     */
    const fast = (extra: Record<string, unknown> = {}) =>
      build({
        'advanced.stockConfirmDelayMs': 0,
        'advanced.stockConfirmPollIntervalMs': 0,
        ...extra,
      });

    const queued = (batchRequestId = 'b-1') => ({ batchRequestId });

    /** A materialised batch: items present and matching itemCount. */
    const batch = (items: Array<Record<string, unknown>>) => ({
      batchRequestId: 'b-1',
      items,
      itemCount: items.length,
      failedItemCount: items.filter((i) => i.status === 'FAILED').length,
    });

    /**
     * What the gateway really answers before a batch is ready. Measured on stage
     * 2026-08-19: `items` is empty while the counters are already filled in, so
     * this shape must never be read as an outcome.
     */
    const notReady = (over: Record<string, unknown> = {}) => ({
      batchRequestId: 'b-1',
      items: [],
      itemCount: null,
      failedItemCount: null,
      ...over,
    });

    it('should post the barcode and quantity, then confirm the batch', async () => {
      httpClient.request
        .mockResolvedValueOnce(queued())
        .mockResolvedValueOnce(batch([{ status: 'SUCCESS' }]));

      const result = await fast().updateStock('869123', 42);

      expect(result).toEqual({ sku: '869123', quantity: 42, success: true });
      expect(httpClient.request).toHaveBeenCalledTimes(2);

      const [postUrl, postOptions] = httpClient.request.mock.calls[0];
      expect(postUrl).toContain('/integration/inventory/sellers/123456/products/price-and-inventory');
      expect(postOptions.method).toBe('POST');
      expect(JSON.parse(postOptions.body)).toEqual({ items: [{ barcode: '869123', quantity: 42 }] });

      const [getUrl] = httpClient.request.mock.calls[1];
      expect(getUrl).toContain('/integration/product/sellers/123456/products/batch-requests/b-1');
    });

    // Trendyol matches inventory on the barcode and accepts a batch that
    // matches nothing without complaining, so sending the local SKU was a
    // silent no-op wherever SKU and barcode differ.
    it('should send the barcode the caller supplies, not the local SKU', async () => {
      httpClient.request
        .mockResolvedValueOnce(queued())
        .mockResolvedValueOnce(batch([{ status: 'SUCCESS' }]));

      const result = await fast().updateStock('KROP-TSHIRT-M', 7, { barcode: '8690000000001' });

      expect(JSON.parse(httpClient.request.mock.calls[0][1].body)).toEqual({
        items: [{ barcode: '8690000000001', quantity: 7 }],
      });
      // The result still reports the SKU: that is what the caller asked about.
      expect(result).toEqual({ sku: 'KROP-TSHIRT-M', quantity: 7, success: true });
    });

    it('should fall back to the SKU when the product has no barcode', async () => {
      httpClient.request
        .mockResolvedValueOnce(queued())
        .mockResolvedValueOnce(batch([{ status: 'SUCCESS' }]));

      await fast().updateStock('869123', 3, { barcode: null });

      expect(JSON.parse(httpClient.request.mock.calls[0][1].body)).toEqual({
        items: [{ barcode: '869123', quantity: 3 }],
      });
    });

    it('should report failure when the batch rejects the item, with the reason', async () => {
      httpClient.request.mockResolvedValueOnce(queued()).mockResolvedValueOnce(
        batch([
          {
            status: 'FAILED',
            failureReasons: ['Barkod bulunamadı. (Barcode: 869123)'],
          },
        ]),
      );

      const result = await fast().updateStock('869123', 5);

      // The gateway accepted the POST and failed the item afterwards; without
      // the second call this returned success.
      expect(result.success).toBe(false);
      expect(result.error).toContain('Barkod bulunamadı');
    });

    it('should join several failure reasons rather than picking one', async () => {
      httpClient.request.mockResolvedValueOnce(queued()).mockResolvedValueOnce(
        batch([
          { status: 'FAILED', failureReasons: ['Barkod bulunamadı.', 'Ürün onayda.'] },
        ]),
      );

      const result = await fast().updateStock('869123', 5);

      expect(result.error).toContain('Barkod bulunamadı.');
      expect(result.error).toContain('Ürün onayda.');
    });

    it('should say so when the batch answers FAILED with no reason', async () => {
      httpClient.request
        .mockResolvedValueOnce(queued())
        .mockResolvedValueOnce(batch([{ status: 'FAILED' }]));

      const result = await fast().updateStock('869123', 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('gerekçe bildirilmedi');
    });

    it('should refuse to claim success when the POST returns no batchRequestId', async () => {
      httpClient.request.mockResolvedValueOnce({});

      const result = await fast().updateStock('869123', 5);

      // Nothing to confirm against, so nothing may be claimed. The batch result
      // is never queried.
      expect(result.success).toBe(false);
      expect(result.error).toContain('batchRequestId');
      expect(httpClient.request).toHaveBeenCalledTimes(1);
    });

    it('should never read an empty item list as success', async () => {
      httpClient.request.mockResolvedValueOnce(queued()).mockResolvedValue({ batchRequestId: 'b-1' });

      // This used to return success and was marked DOĞRULANAMADI. The stage run
      // on 2026-08-19 settled it: an invalid barcode answered exactly this shape
      // and was reported as applied. Empty means "not ready", never "fine".
      const result = await fast({ 'advanced.stockConfirmTimeoutMs': 0 }).updateStock('869123', 5);

      expect(result.success).toBe(false);
      expect(result.pending).toBe(true);
    });

    it('should report failure instead of throwing so one SKU cannot abort a sync', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 401),
      );

      const result = await fast().updateStock('869123', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('kimlik doğrulaması reddedildi');
    });

    it('should keep polling until the batch materialises, then report success', async () => {
      httpClient.request
        .mockResolvedValueOnce(queued())
        .mockResolvedValueOnce(notReady())
        .mockResolvedValueOnce(notReady())
        .mockResolvedValueOnce(batch([{ status: 'SUCCESS' }]));

      const result = await fast().updateStock('869123', 5);

      expect(result).toMatchObject({ success: true });
      // POST + three reads: the two empty ones were not an answer.
      expect(httpClient.request).toHaveBeenCalledTimes(4);
    });

    it('should keep polling until the batch materialises, then report the failure', async () => {
      httpClient.request
        .mockResolvedValueOnce(queued())
        .mockResolvedValueOnce(notReady())
        .mockResolvedValueOnce(
          batch([
            {
              status: 'FAILED',
              failureReasons: ['2738  tedarikçi id si ve 0000000000000 barkod ile ürün bulunamadı.'],
            },
          ]),
        );

      const result = await fast().updateStock('0000000000000', 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ürün bulunamadı');
    });

    /**
     * The trap this whole change exists for. On stage the counters filled in
     * five seconds before `items` did, and reported zero failures for an item
     * that had in fact failed.
     */
    it('should not trust itemCount while items is still empty', async () => {
      httpClient.request
        .mockResolvedValueOnce(queued())
        .mockResolvedValueOnce(notReady({ itemCount: 1, failedItemCount: 0 }))
        .mockResolvedValueOnce(batch([{ status: 'FAILED', failureReasons: ['ürün bulunamadı.'] }]));

      const result = await fast().updateStock('869123', 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ürün bulunamadı');
    });

    it('should report pending — not success — when the batch never materialises', async () => {
      httpClient.request.mockResolvedValueOnce(queued()).mockResolvedValue(notReady());

      const result = await fast({ 'advanced.stockConfirmTimeoutMs': 0 }).updateStock('869123', 5);

      // Neither outcome: Trendyol may still apply it, so reporting failure would
      // send the caller retrying an update that is already in flight.
      expect(result.success).toBe(false);
      expect(result.pending).toBe(true);
      expect(result.taskId).toBe('b-1');
      expect(result.error).toContain('zaman aşımına');
    });

    it('should keep failing loudly when the confirmation call itself fails', async () => {
      httpClient.request
        .mockResolvedValueOnce(queued())
        .mockRejectedValueOnce(new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 500));

      const result = await fast().updateStock('869123', 1);

      expect(result.success).toBe(false);
    });
  });

  describe('categories', () => {
    it('should return the categories the API sends', async () => {
      httpClient.request.mockResolvedValue({ categories: [{ id: 1, name: 'Tişört' }] });

      await expect(build().getCategories()).resolves.toEqual([{ id: 1, name: 'Tişört' }]);
    });

    it('should surface a failure rather than substituting a fake tree', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 500),
      );

      await expect(build().getCategories()).rejects.toThrow('Trendyol tarafında geçici hata');
    });
  });

  // Feeds the two required address fields in the settings form. The manifest
  // pointed at this endpoint before it existed, so the form could not be
  // completed at all.
  describe('addresses', () => {
    it('should return id/label rows the settings form can render', async () => {
      httpClient.request.mockResolvedValue({
        supplierAddresses: [
          {
            id: 55,
            address: 'Sokak 1 No 2',
            district: 'Kadıköy',
            city: 'İstanbul',
            shipment: true,
            returningAddress: false,
            invoice: true,
            default: true,
          },
        ],
      });

      const [address] = await build().getAddresses();

      expect(lastCall()[0]).toContain('/integration/sellers/123456/addresses');
      expect(address).toEqual({
        id: '55',
        label: 'Sokak 1 No 2, Kadıköy, İstanbul',
        shipment: true,
        returningAddress: false,
        invoice: true,
        isDefault: true,
      });
    });

    it('should keep a row selectable when it carries no readable address', async () => {
      httpClient.request.mockResolvedValue({ supplierAddresses: [{ id: 7 }] });

      const [address] = await build().getAddresses();

      expect(address).toMatchObject({ id: '7', label: '#7' });
    });

    it('should return an empty list rather than throwing on an unexpected shape', async () => {
      httpClient.request.mockResolvedValue({});

      await expect(build().getAddresses()).resolves.toEqual([]);
    });
  });
});
