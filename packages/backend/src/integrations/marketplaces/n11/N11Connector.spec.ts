import { N11Connector } from './N11Connector';
import { N11Mapper } from './N11Mapper';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * Every URL asserted here comes from n11's seller documentation
 * ("n11 RestAPI Entegrasyon Servisleri", 2026-08-17). The version before it
 * pinned four endpoints that did not exist and passed anyway, so the rule is:
 * an assertion about a path is only as good as the document behind it.
 *
 * Still unverified against a real seller account — hence `defaultMode`.
 */
describe('N11Connector', () => {
  const CREDENTIALS = { apiKey: 'app-key', apiSecret: 'app-secret' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };
  const originalEnvMode = process.env.MARKETPLACE_MODE;

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new N11Connector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const live = (extra: Record<string, unknown> = {}) => build({ 'general.mode': 'live', ...extra });

  const calls = () => httpClient.request.mock.calls;
  const lastCall = () => calls()[calls().length - 1];
  const urlsHit = () => calls().map((call: any[]) => String(call[0]));
  const bodyOf = (index: number) => JSON.parse(calls()[index][1].body);

  /** Spring page envelope, as both paged n11 services return it. */
  const page = (content: unknown[], totalPages = 1) => ({ content, totalPages, totalElements: content.length });

  /** One shipment package shaped like the document's example. */
  const shipmentPackage = (over: Record<string, unknown> = {}) => ({
    orderNumber: '203872347637',
    id: '112999455244259',
    customerEmail: 'n11@n11.com',
    customerfullName: 'N11 müşteri',
    shippingAddress: {
      address: 'Reşitpaşa Mah',
      neighborhood: 'Reşitpaşa',
      district: 'Sarıyer',
      city: 'İstanbul',
      gsm: '5xxxxxxxxx',
    },
    lines: [
      { stockCode: '20242024', productName: 'Ayakkabı', quantity: 2, price: 292.8, totalSellerDiscountPrice: 5.8 },
    ],
    totalAmount: 579.8,
    shipmentPackageStatus: 'Created',
    ...over,
  });

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
    delete process.env.MARKETPLACE_MODE;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    if (originalEnvMode === undefined) delete process.env.MARKETPLACE_MODE;
    else process.env.MARKETPLACE_MODE = originalEnvMode;
  });

  // ------------------------------------------------------------ mode resolution

  describe('mode resolution', () => {
    it('should default to simulation: no endpoint has run against a real account', () => {
      expect(build().connectionMode).toEqual({ mode: 'simulation', source: 'default' });
    });

    it('should let the environment override the connector default', () => {
      process.env.MARKETPLACE_MODE = 'live';
      expect(build().connectionMode).toEqual({ mode: 'live', source: 'env' });
    });

    it('should let the saved setting override the environment', () => {
      process.env.MARKETPLACE_MODE = 'live';
      expect(build({ 'general.mode': 'simulation' }).connectionMode).toEqual({
        mode: 'simulation',
        source: 'setting',
      });
    });
  });

  // ----------------------------------------------------------------- simulation

  describe('simulation mode', () => {
    it('should serve every operation without a single request', async () => {
      const connector = build();

      const test = await connector.testConnection();
      const orders = await connector.getOrders();
      const products = await connector.getProducts();
      const stock = await connector.updateStock('SIM-SKU-1', 7);
      const categories = await connector.getCategories();

      expect(httpClient.request).not.toHaveBeenCalled();
      expect(test.success).toBe(true);
      expect(test.message).toContain('SİMÜLASYON');
      expect(orders.length).toBeGreaterThan(0);
      expect(products.length).toBeGreaterThan(0);
      expect(stock.success).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should stamp the mode on every payload', async () => {
      const connector = build();

      for (const payload of [
        await connector.testConnection(),
        (await connector.getOrders())[0],
        (await connector.getProducts())[0],
        await connector.updateStock('SIM-SKU-1', 1),
      ]) {
        expect(payload).toMatchObject({ mode: 'simulation', modeSource: 'default' });
      }
    });

    it('should mark a simulated order so it cannot pass for a real one', async () => {
      const [order] = await build().getOrders();

      expect(order.orderNumber).toMatch(/^SIM-/);
    });

    it('should still refuse a blank credential', async () => {
      const result = await build({}, { apiKey: 'k', apiSecret: '' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('apiSecret');
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------ products

  describe('getProducts', () => {
    it('should read the documented product endpoint with its maximum page size', async () => {
      httpClient.request.mockResolvedValue(page([{ stockCode: 'SKU-1', title: 'Ürün', salePrice: 10, quantity: 3 }]));

      const [product] = await live().getProducts();

      const [url] = lastCall();
      expect(url).toContain('https://api.n11.com/ms/product-query');
      expect(url).toContain('page=0');
      expect(url).toContain('size=250'); // documented maximum
      expect(product).toMatchObject({ sku: 'SKU-1', name: 'Ürün', price: 10, stockQuantity: 3 });
    });

    it('should map the fields the document names, not invented ones', async () => {
      httpClient.request.mockResolvedValue(
        page([
          {
            stockCode: 'TestSKU123',
            title: 'Test Ürünü',
            description: 'Açıklama',
            salePrice: 10000.0,
            quantity: 2,
            barcode: null,
            currencyType: 'TL',
            imageUrls: ['https://n11scdn3.akamaized.net/a1.jpg'],
          },
        ]),
      );

      const [product] = await live().getProducts();

      expect(product).toEqual(
        expect.objectContaining({
          sku: 'TestSKU123',
          name: 'Test Ürünü',
          description: 'Açıklama',
          price: 10000,
          stockQuantity: 2,
          image: 'https://n11scdn3.akamaized.net/a1.jpg',
          barcode: undefined,
        }),
      );
    });

    it('should skip a product priced in an unverified currency instead of importing it', async () => {
      httpClient.request.mockResolvedValue(
        page([
          { stockCode: 'TRY-1', title: 'Lira', salePrice: 10, quantity: 1, currencyType: 'TL' },
          { stockCode: 'USD-1', title: 'Dolar', salePrice: 10, quantity: 1, currencyType: 'USD' },
        ]),
      );

      const products = await live().getProducts();

      expect(products.map((p) => p.sku)).toEqual(['TRY-1']);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('USD'));
    });

    it('should stop at an empty page rather than trusting the page count', async () => {
      httpClient.request
        .mockResolvedValueOnce(page([{ stockCode: 'A', salePrice: 1, quantity: 1 }], 5))
        .mockResolvedValueOnce(page([], 5));

      expect(await live().getProducts()).toHaveLength(1);
      expect(httpClient.request).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------- orders

  describe('getOrders', () => {
    it('should read the documented order endpoint — not under /ms/', async () => {
      httpClient.request.mockResolvedValue(page([]));

      await live({ 'orders.importStatuses': ['created'] }).getOrders();

      const [url] = lastCall();
      expect(url).toContain('https://api.n11.com/rest/delivery/v1/shipmentPackages');
      expect(url).toContain('status=Created');
      expect(url).toContain('size=100'); // documented maximum
    });

    it('should issue one request per status, because n11 takes only one', async () => {
      httpClient.request.mockResolvedValue(page([]));

      await live({ 'orders.importStatuses': ['created', 'picking', 'shipped'] }).getOrders();

      const statuses = urlsHit().map((url) => new URL(url).searchParams.get('status'));
      expect(statuses).toEqual(['Created', 'Picking', 'Shipped']);
    });

    it('should drop a status n11 does not define instead of asking for it', async () => {
      httpClient.request.mockResolvedValue(page([]));

      // 'invoiced' and 'returned' exist in the shared settings vocabulary but
      // not in n11's; asking for them returns nothing at all.
      await live({ 'orders.importStatuses': ['created', 'invoiced', 'returned'] }).getOrders();

      const statuses = urlsHit().map((url) => new URL(url).searchParams.get('status'));
      expect(statuses).toEqual(['Created']);
    });

    it('should clamp the backfill window to the 15 days n11 will serve', async () => {
      httpClient.request.mockResolvedValue(page([]));

      await live({ 'orders.backfillDays': 90, 'orders.importStatuses': ['created'] }).getOrders();

      const params = new URL(lastCall()[0]).searchParams;
      const spanDays = (Number(params.get('endDate')) - Number(params.get('startDate'))) / 86_400_000;
      expect(spanDays).toBeCloseTo(15, 1);
      // Milliseconds, per the document — not ISO strings.
      expect(Number(params.get('startDate'))).toBeGreaterThan(1_600_000_000_000);
    });

    it('should key an order on the package, keeping the seller-facing number', async () => {
      httpClient.request.mockResolvedValue(page([shipmentPackage()]));

      const [order] = await live({ 'orders.importStatuses': ['created'] }).getOrders();

      // One n11 order can split into packages that ship separately, so the
      // package is what a row represents.
      expect(order.orderNumber).toBe('203872347637-112999455244259');
      expect(order.marketplaceOrderNumber).toBe('203872347637');
    });

    it('should fall back to the order number when n11 sends no package id', async () => {
      // "Konuma Özel Teslimat": n11 delivers, and id comes back null.
      httpClient.request.mockResolvedValue(page([shipmentPackage({ id: null })]));

      const [order] = await live({ 'orders.importStatuses': ['created'] }).getOrders();

      expect(order.orderNumber).toBe('203872347637');
    });

    it('should read the buyer from the field n11 misspells', async () => {
      httpClient.request.mockResolvedValue(page([shipmentPackage()]));

      const [order] = await live({ 'orders.importStatuses': ['created'] }).getOrders();

      expect(order.customerName).toBe('N11 müşteri');
      expect(order.customerEmail).toBe('n11@n11.com');
      expect(order.shippingAddress).toBe('Reşitpaşa Mah, Reşitpaşa, Sarıyer, İstanbul');
    });

    it('should compute a line total with the documented discount formula', async () => {
      httpClient.request.mockResolvedValue(page([shipmentPackage()]));

      const [order] = await live({ 'orders.importStatuses': ['created'] }).getOrders();

      // (292.8 × 2) − 5.8 = 579.80, which is n11's own sellerInvoiceAmount.
      expect(order.items[0]).toMatchObject({ sku: '20242024', quantity: 2, unitPrice: 292.8 });
      expect(order.items[0].totalPrice).toBeCloseTo(579.8, 2);
    });

    it('should warn when the package total cannot be reconciled with its lines', async () => {
      // n11's own example has a 149.99 gap that no documented field explains.
      httpClient.request.mockResolvedValue(page([shipmentPackage({ totalAmount: 729.79 })]));

      const [order] = await live({ 'orders.importStatuses': ['created'] }).getOrders();

      expect(order.totalAmount).toBe(729.79); // what the seller collects
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('fark var'));
    });

    it('should assume TRY, since a package carries no currency', async () => {
      httpClient.request.mockResolvedValue(page([shipmentPackage()]));

      const [order] = await live({ 'orders.importStatuses': ['created'] }).getOrders();

      expect(order.currency).toBe('TRY');
    });
  });

  // ------------------------------------------------------------ status mapping

  describe('status mapping', () => {
    it.each([
      ['Created', 'pending'],
      ['Picking', 'processing'],
      ['Shipped', 'shipped'],
      ['Delivered', 'delivered'],
      ['Cancelled', 'cancelled'],
      // Reachable only from Picking: the package whose contents were split out.
      ['UnPacked', 'processing'],
      // The seller could not supply it — the order is off.
      ['UnSupplied', 'cancelled'],
    ])('should map %s to %s', (n11Status, expected) => {
      expect(N11Mapper.toKroptosStatus(n11Status)).toBe(expected);
    });

    it('should let the seller status map override the connector mapping', async () => {
      httpClient.request.mockResolvedValue(page([shipmentPackage()]));

      const [order] = await live({
        'orders.importStatuses': ['created'],
        'orders.statusMap': { created: 'processing' },
      }).getOrders();

      expect(order.status).toBe('processing');
    });

    it('should apply the order prefix on top of the package key', async () => {
      httpClient.request.mockResolvedValue(page([shipmentPackage()]));

      const [order] = await live({
        'orders.importStatuses': ['created'],
        'orders.numberPrefix': 'N11-',
      }).getOrders();

      expect(order.orderNumber).toBe('N11-203872347637-112999455244259');
    });
  });

  // --------------------------------------------------------------- updateStock

  describe('updateStock', () => {
    const ack = (over: Record<string, unknown> = {}) => ({ id: 1092, type: 'SKU_UPDATE', status: 'IN_QUEUE', ...over });
    const details = (over: Record<string, unknown> = {}) => ({ taskId: 1092, status: 'PROCESSED', ...over });

    it('should post the documented task payload, without touching price', async () => {
      httpClient.request
        .mockResolvedValueOnce(ack())
        .mockResolvedValueOnce(details({ skus: { content: [{ itemCode: 'SKU-9', status: 'SUCCESS' }] } }));

      await live().updateStock('SKU-9', 5);

      expect(urlsHit()[0]).toBe('https://api.n11.com/ms/product/tasks/price-stock-update');
      expect(bodyOf(0)).toEqual({
        payload: { integrator: 'KroptOS', skus: [{ stockCode: 'SKU-9', quantity: 5 }] },
      });
      // listPrice/salePrice are omitted on purpose: a field left out is left
      // untouched, and whether salePrice includes VAT is still unverified.
      expect(bodyOf(0).payload.skus[0]).not.toHaveProperty('salePrice');
    });

    it('should let the seller override the integrator name', async () => {
      httpClient.request
        .mockResolvedValueOnce(ack())
        .mockResolvedValueOnce(details({ skus: { content: [{ itemCode: 'SKU-9', status: 'SUCCESS' }] } }));

      await live({ 'advanced.integrator': 'AcmeEnt' }).updateStock('SKU-9', 5);

      expect(bodyOf(0).payload.integrator).toBe('AcmeEnt');
    });

    it('should report success only once n11 says the SKU succeeded', async () => {
      httpClient.request
        .mockResolvedValueOnce(ack())
        .mockResolvedValueOnce(details({ skus: { content: [{ itemCode: 'SKU-9', status: 'SUCCESS' }] } }));

      const result = await live().updateStock('SKU-9', 5);

      expect(urlsHit()[1]).toBe('https://api.n11.com/ms/product/task-details/page-query');
      expect(result).toMatchObject({ sku: 'SKU-9', quantity: 5, success: true, taskId: '1092' });
      expect(result.pending).toBeUndefined();
    });

    it('should report failure with n11 reason when the SKU failed', async () => {
      httpClient.request
        .mockResolvedValueOnce(ack())
        .mockResolvedValueOnce(
          details({ skus: { content: [{ itemCode: 'SKU-9', status: 'Fail', reasons: ['Stok kodu bulunamadı.'] }] } }),
        );

      const result = await live().updateStock('SKU-9', 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Stok kodu bulunamadı.');
    });

    it('should report pending — not success — while the task is still queued', async () => {
      httpClient.request.mockResolvedValueOnce(ack()).mockResolvedValueOnce(details({ status: 'IN_QUEUE' }));

      const result = await live().updateStock('SKU-9', 5);

      // Neither: claiming success would assert stock n11 has not applied, and
      // claiming failure would send the caller retrying a queued update.
      expect(result.success).toBe(false);
      expect(result.pending).toBe(true);
      expect(result.taskId).toBe('1092');
    });

    it('should poll exactly once, never loop', async () => {
      httpClient.request.mockResolvedValueOnce(ack()).mockResolvedValueOnce(details({ status: 'IN_QUEUE' }));

      await live().updateStock('SKU-9', 5);

      expect(httpClient.request).toHaveBeenCalledTimes(2);
    });

    it('should treat a REJECT as failure without polling', async () => {
      httpClient.request.mockResolvedValueOnce(ack({ status: 'REJECT', reasons: ['Geçersiz fiyat.'] }));

      const result = await live().updateStock('SKU-9', 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Geçersiz fiyat.');
      expect(httpClient.request).toHaveBeenCalledTimes(1);
    });

    it('should stay pending when the confirmation call itself fails', async () => {
      httpClient.request.mockResolvedValueOnce(ack()).mockRejectedValueOnce(new Error('timeout'));

      const result = await live().updateStock('SKU-9', 5);

      // The update was accepted; only our read of the outcome failed.
      expect(result.pending).toBe(true);
      expect(result.error).toContain('task sonucu okunamadı');
    });

    it('should never throw, whatever happens', async () => {
      httpClient.request.mockRejectedValue(new Error('boom'));

      await expect(live().updateStock('SKU-9', 5)).resolves.toMatchObject({ success: false });
    });
  });

  // -------------------------------------------------------------- categories

  describe('categories', () => {
    it('should read the confirmed category endpoints', async () => {
      httpClient.request.mockResolvedValue({ categories: [{ id: 1000, name: 'Kitap' }] });

      const connector = live();
      await connector.getCategories();
      expect(lastCall()[0]).toBe('https://api.n11.com/cdn/categories');

      httpClient.request.mockResolvedValue({ id: 1002571, categoryAttributes: [] });
      await connector.getCategoryAttributes('1002571');
      expect(lastCall()[0]).toBe('https://api.n11.com/cdn/category/1002571/attribute');
    });

    it('should accept a bare array as well as an envelope', async () => {
      httpClient.request.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      expect(await live().getCategories()).toHaveLength(2);
    });
  });

  // ------------------------------------------------------------- rate limits

  describe('rate limits', () => {
    it('should throttle orders on n11 published quota, per service family', async () => {
      httpClient.request.mockResolvedValue(page([]));

      await live({ 'orders.importStatuses': ['created'] }).getOrders();

      // Documented: 1000 requests/minute for the order service.
      expect(rateLimiter.throttle).toHaveBeenCalledWith('N11:orders', 100, 60000);
    });

    it('should keep the seller setting as the ceiling, never raise it', async () => {
      httpClient.request.mockResolvedValue(page([]));

      await live({ 'orders.importStatuses': ['created'], 'advanced.rateLimitPerMinute': 30 }).getOrders();

      // min(setting 30, published 1000) — a higher setting cannot exceed n11's.
      expect(rateLimiter.throttle).toHaveBeenCalledWith('N11:orders', 30, 60000);
    });

    it('should throttle products conservatively, since n11 publishes no quota', async () => {
      httpClient.request.mockResolvedValue(page([]));

      await live({ 'advanced.rateLimitPerMinute': 1000 }).getProducts();

      expect(rateLimiter.throttle).toHaveBeenCalledWith('N11:products', 60, 60000);
    });
  });

  // ------------------------------------------------------------ error mapping

  describe('error mapping', () => {
    it('should map a 429 onto the rate limit setting', async () => {
      const { MarketplaceHttpError } = jest.requireActual('../core/MarketplaceHttpClient');
      httpClient.request.mockRejectedValue(new MarketplaceHttpError('failed', 502, 429));

      const result = await live().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('advanced.rateLimitPerMinute');
      expect(result.mode).toBe('live');
    });

    it('should explain a gateway HTML page instead of pasting it', async () => {
      const { MarketplaceHttpError } = jest.requireActual('../core/MarketplaceHttpClient');
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', 502, 503, '<html><body>Application is not available</body></html>'),
      );

      const result = await live().testConnection();

      expect(result.message).toContain('HTML sayfası');
      expect(result.message).not.toContain('<html>');
    });
  });
});
