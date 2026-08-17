import { HttpStatus } from '@nestjs/common';
import { HepsiburadaConnector } from './HepsiburadaConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { collectDefaults, missingRequiredKeys } from '@kroptos/shared';
import { MarketplaceSettingsRegistry } from '../settings/manifest.registry';

/**
 * Pins the request shape (host per API family, auth, offset paging) and the
 * error mapping. NOT proof the endpoints exist: a mock answers whatever it is
 * told to. Live verification against a real merchant account is outstanding.
 */
describe('HepsiburadaConnector', () => {
  const CREDENTIALS = { merchantId: 'm-1', apiKey: 'key', apiSecret: 'secret' };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (settings: Record<string, unknown> = {}, credentials = CREDENTIALS) =>
    new HepsiburadaConnector(
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

  describe('transport', () => {
    it('should use the listing host and Basic auth for a connection test', async () => {
      httpClient.request.mockResolvedValue({ items: [], totalCount: 4 });

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      const [url, options] = lastCall();
      expect(url).toContain('https://listing-external.hepsiburada.com/listings/merchantid/m-1');
      expect(options.headers.Authorization).toBe(
        `Basic ${Buffer.from('key:secret').toString('base64')}`,
      );
      expect(options.headers['User-Agent']).toBe('m-1 - SelfIntegration');
    });

    it('should use the order host for orders and the catalogue host for categories', async () => {
      httpClient.request.mockResolvedValue({ items: [], totalCount: 0 });
      await build().getOrders();
      expect(lastCall()[0]).toContain('https://oms-external.hepsiburada.com/orders/merchantid/m-1');

      httpClient.request.mockResolvedValue({ data: [] });
      await build().getCategories();
      expect(lastCall()[0]).toContain('https://mpop.hepsiburada.com/product/api/categories');
    });

    it('should switch every host to the sandbox twin', async () => {
      httpClient.request.mockResolvedValue({ items: [], totalCount: 0 });

      await build({ 'general.environment': 'sandbox' }).getProducts();

      expect(lastCall()[0]).toContain('https://listing-external-sit.hepsiburada.com');
    });

    it('should fail before any request when a credential is blank', async () => {
      const result = await build({}, { merchantId: 'm-1', apiKey: 'k', apiSecret: '' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('apiSecret');
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('should explain a 401 rather than leaking the status', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 401),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('kimlik doğrulaması reddedildi');
    });
  });

  describe('paging', () => {
    const listing = (sku: string) => ({ merchantSku: sku, productName: 'Ürün', price: 10, availableStock: 3 });

    it('should stop on a short page instead of spending the page budget', async () => {
      httpClient.request.mockResolvedValue({ items: [listing('SKU-1')], totalCount: 1 });

      const products = await build().getProducts();

      expect(httpClient.request).toHaveBeenCalledTimes(1);
      expect(products).toHaveLength(1);
      expect(lastCall()[0]).toContain('offset=0');
      expect(lastCall()[0]).toContain('limit=100');
    });

    it('should advance the offset while full pages keep coming', async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) => listing(`SKU-${i}`));
      httpClient.request
        .mockResolvedValueOnce({ items: fullPage, totalCount: 150 })
        .mockResolvedValueOnce({ items: [listing('SKU-100')], totalCount: 150 });

      const products = await build().getProducts();

      expect(httpClient.request).toHaveBeenCalledTimes(2);
      expect(products).toHaveLength(101);
      expect(lastCall()[0]).toContain('offset=100');
    });
  });

  describe('orders', () => {
    const order = (orderNumber: string, status: string) => ({
      id: 'o-1',
      orderNumber,
      status,
      totalPrice: 60,
      customer: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
      shippingAddress: { address: 'Sokak 1', city: 'İstanbul', town: 'Kadıköy' },
      items: [{ merchantSku: 'SKU-1', productName: 'Ürün', quantity: 2, price: 30 }],
    });

    it('should map a Hepsiburada order onto the unified shape', async () => {
      httpClient.request.mockResolvedValue({ items: [order('HB-1', 'Open')], totalCount: 1 });

      const [unified] = await build().getOrders();

      expect(unified).toMatchObject({
        orderNumber: 'HB-1',
        customerName: 'Ada Lovelace',
        status: 'pending',
        source: 'hepsiburada',
        totalAmount: 60,
      });
      expect(unified.items).toEqual([
        { sku: 'SKU-1', name: 'Ürün', quantity: 2, unitPrice: 30, totalPrice: 60 },
      ]);
    });

    it('should fold marketplace status names onto the settings vocabulary', async () => {
      httpClient.request.mockResolvedValue({
        items: [order('HB-1', 'Open'), order('HB-2', 'InTransit'), order('HB-3', 'Cancelled')],
        totalCount: 3,
      });

      const orders = await build({ 'orders.importStatuses': ['created', 'shipped'] }).getOrders();

      expect(orders.map((o) => o.orderNumber)).toEqual(['HB-1', 'HB-2']);
    });

    /**
     * The fold used to stop at the connector: the mapper compared the raw name
     * with `===`, so every status outside Open/Shipped/Delivered/Cancelled
     * reached the database as "pending" — a dispatched order looked unshipped.
     */
    it('should carry the folded status through to the domain status', async () => {
      const names = ['Open', 'Packaged', 'InTransit', 'Delivered', 'Cancelled', 'ReadyToShip'];
      httpClient.request.mockResolvedValue({
        items: names.map((status, i) => order(`HB-${i}`, status)),
        totalCount: names.length,
      });

      const orders = await build({ 'orders.importStatuses': [] }).getOrders();

      expect(orders.map((o) => o.status)).toEqual([
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'processing',
      ]);
    });

    it('should fall back to a top-level customerName when there is no customer object', async () => {
      httpClient.request.mockResolvedValue({
        items: [{ id: 'o', orderNumber: 'HB-9', status: 'Open', customerName: 'Zeynep Kaya', items: [] }],
        totalCount: 1,
      });

      const [unified] = await build({ 'orders.importStatuses': [] }).getOrders();

      expect(unified.customerName).toBe('Zeynep Kaya');
    });
  });

  /**
   * `triggerSync` refuses an integration whose `missingRequired` is non-empty.
   * A required field the seller has no way to fill therefore disables the whole
   * marketplace, quietly and permanently — which is what a required
   * `resourceSelect` on an endpoint the backend never exposed did here.
   */
  describe('settings manifest', () => {
    it('should be completable from credentials and defaults alone', () => {
      const manifest = new MarketplaceSettingsRegistry().getManifest('hepsiburada');

      expect(missingRequiredKeys(manifest, collectDefaults(manifest))).toEqual([]);
    });
  });

  describe('updateStock', () => {
    it('should post the merchant SKU and available stock', async () => {
      httpClient.request.mockResolvedValue({ id: 'batch-1' });

      const result = await build().updateStock('SKU-1', 12);

      expect(result).toEqual({ sku: 'SKU-1', quantity: 12, success: true });
      const [url, options] = lastCall();
      expect(url).toContain('/listings/merchantid/m-1/stock-uploads');
      expect(JSON.parse(options.body)).toEqual([{ merchantSku: 'SKU-1', availableStock: 12 }]);
    });

    it('should report failure instead of throwing', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 500),
      );

      const result = await build().updateStock('SKU-1', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('geçici hata');
    });
  });
});
