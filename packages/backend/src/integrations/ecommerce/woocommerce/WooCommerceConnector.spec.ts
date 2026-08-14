import { WooCommerceConnector } from './WooCommerceConnector';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

describe('WooCommerceConnector', () => {
  let httpClient: MarketplaceHttpClient;
  let rateLimiter: MarketplaceRateLimiter;

  beforeEach(() => {
    httpClient = new MarketplaceHttpClient();
    rateLimiter = new MarketplaceRateLimiter();
  });

  const validCreds = {
    consumerKey: 'ck_test_12345',
    consumerSecret: 'cs_test_67890',
  };

  const validSettings = {
    'general.shopUrl': 'https://mywoostore.example.com',
  };

  describe('parseAmount', () => {
    it('parses major unit amounts correctly without 100x scaling', () => {
      const connector = new WooCommerceConnector(validCreds, httpClient, rateLimiter, validSettings);
      expect(connector.parseAmount('49.90')).toBe(49.9);
      expect(connector.parseAmount(49.9)).toBe(49.9);
      expect(connector.parseAmount('1299.00')).toBe(1299);
      expect(connector.parseAmount('0')).toBe(0);
      expect(connector.parseAmount(null)).toBe(0);
      expect(connector.parseAmount(undefined)).toBe(0);
      expect(connector.parseAmount('invalid')).toBe(0);
    });
  });

  describe('shopUrl handling', () => {
    it('returns failure result if shopUrl is not provided in settings', async () => {
      const connector = new WooCommerceConnector(validCreds, httpClient, rateLimiter, {});
      const res = await connector.testConnection();
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/general.shopUrl/i);
    });

    it('normalises shopUrl without trailing slashes', async () => {
      const connector = new WooCommerceConnector(
        validCreds,
        httpClient,
        rateLimiter,
        { 'general.shopUrl': 'https://example.com///' },
      );

      jest.spyOn(httpClient, 'request').mockResolvedValue([{ id: 1, name: 'Product 1' }]);

      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(httpClient.request).toHaveBeenCalledWith(
        'https://example.com/wp-json/wc/v3/products?per_page=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${Buffer.from('ck_test_12345:cs_test_67890').toString('base64')}`,
          }),
        }),
      );
    });
  });

  describe('credentials validation', () => {
    it('returns failure result if consumerKey or consumerSecret is missing', async () => {
      const connector = new WooCommerceConnector(
        { consumerKey: '' },
        httpClient,
        rateLimiter,
        validSettings,
      );

      const res = await connector.testConnection();
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/kimlik bilgileri eksik/i);
    });
  });

  describe('getOrders', () => {
    it('fetches and maps WooCommerce orders correctly', async () => {
      const connector = new WooCommerceConnector(validCreds, httpClient, rateLimiter, validSettings);

      const mockWooOrders = [
        {
          id: 101,
          number: '1001',
          status: 'processing',
          date_paid: '2026-08-10T12:00:00',
          total: '249.99',
          currency: 'TRY',
          billing: {
            first_name: 'Ahmet',
            last_name: 'Yılmaz',
            email: 'ahmet@example.com',
          },
          line_items: [
            {
              product_id: 55,
              variation_id: 0,
              sku: 'WOO-TSHIRT-RED',
              name: 'Kırmızı Tişört',
              quantity: 2,
              price: '124.995',
              total: '249.99',
            },
          ],
        },
      ];

      jest.spyOn(httpClient, 'request').mockResolvedValue(mockWooOrders);

      const orders = await connector.getOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0]).toEqual({
        orderNumber: '1001',
        customerName: 'Ahmet Yılmaz',
        customerEmail: 'ahmet@example.com',
        status: 'processing',
        paymentStatus: 'paid',
        totalAmount: 249.99,
        currency: 'TRY',
        source: 'woocommerce',
        items: [
          {
            sku: 'WOO-TSHIRT-RED',
            name: 'Kırmızı Tişört',
            quantity: 2,
            unitPrice: 125,
            totalPrice: 249.99,
          },
        ],
      });
    });
  });

  describe('updateStock', () => {
    it('updates product stock quantity by SKU', async () => {
      const connector = new WooCommerceConnector(validCreds, httpClient, rateLimiter, validSettings);

      // Search response
      jest
        .spyOn(httpClient, 'request')
        .mockResolvedValueOnce([{ id: 55, sku: 'WOO-TSHIRT-RED', stock_quantity: 10 }])
        // Update response
        .mockResolvedValueOnce({ id: 55, stock_quantity: 25 });

      const res = await connector.updateStock('WOO-TSHIRT-RED', 25);
      expect(res.success).toBe(true);
      expect(res.quantity).toBe(25);
      expect(httpClient.request).toHaveBeenLastCalledWith(
        'https://mywoostore.example.com/wp-json/wc/v3/products/55',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ manage_stock: true, stock_quantity: 25 }),
        }),
      );
    });

    it('returns unsuccessful result if product SKU is not found', async () => {
      const connector = new WooCommerceConnector(validCreds, httpClient, rateLimiter, validSettings);

      jest.spyOn(httpClient, 'request').mockResolvedValueOnce([]);

      const res = await connector.updateStock('NON-EXISTENT-SKU', 15);
      expect(res.success).toBe(false);
      expect(res.error).toContain('bulunamadı');
    });
  });
});
