import { ShopifyConnector } from './ShopifyConnector';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

describe('ShopifyConnector', () => {
  let httpClient: MarketplaceHttpClient;
  let rateLimiter: MarketplaceRateLimiter;

  beforeEach(() => {
    httpClient = new MarketplaceHttpClient();
    rateLimiter = new MarketplaceRateLimiter();
  });

  const validCreds = {
    accessToken: 'shpat_test_token_12345',
  };

  const validSettings = {
    'general.shopDomain': 'test-store.myshopify.com',
  };

  describe('parseAmount', () => {
    it('parses major unit amounts correctly', () => {
      const connector = new ShopifyConnector(validCreds, httpClient, rateLimiter, validSettings);
      expect(connector.parseAmount('99.95')).toBe(99.95);
      expect(connector.parseAmount(99.95)).toBe(99.95);
      expect(connector.parseAmount('0')).toBe(0);
      expect(connector.parseAmount(null)).toBe(0);
    });
  });

  describe('shopDomain handling', () => {
    it('returns failure result if shopDomain is missing', async () => {
      const connector = new ShopifyConnector(validCreds, httpClient, rateLimiter, {});
      const res = await connector.testConnection();
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/general.shopDomain/i);
    });

    it('normalises shopDomain cleanly', async () => {
      const connector = new ShopifyConnector(
        validCreds,
        httpClient,
        rateLimiter,
        { 'general.shopDomain': 'https://my-shop.myshopify.com/' },
      );

      jest.spyOn(httpClient, 'request').mockResolvedValue({ shop: { id: 1, name: 'My Test Shop' } });

      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('My Test Shop');
      expect(httpClient.request).toHaveBeenCalledWith(
        'https://my-shop.myshopify.com/admin/api/2024-01/shop.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Shopify-Access-Token': 'shpat_test_token_12345',
          }),
        }),
      );
    });
  });

  describe('getOrders', () => {
    it('fetches and maps Shopify orders correctly', async () => {
      const connector = new ShopifyConnector(validCreds, httpClient, rateLimiter, validSettings);

      const mockShopifyOrders = {
        orders: [
          {
            id: 991,
            order_number: 1005,
            financial_status: 'paid',
            total_price: '199.90',
            currency: 'USD',
            customer: {
              first_name: 'Jane',
              last_name: 'Doe',
              email: 'jane@example.com',
            },
            line_items: [
              {
                product_id: 88,
                variant_id: 881,
                sku: 'SHPFY-ITEM-1',
                title: 'Shopify Item 1',
                quantity: 2,
                price: '99.95',
              },
            ],
          },
        ],
      };

      jest.spyOn(httpClient, 'request').mockResolvedValue(mockShopifyOrders);

      const orders = await connector.getOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0]).toEqual({
        orderNumber: '1005',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        status: 'paid',
        paymentStatus: 'paid',
        totalAmount: 199.9,
        currency: 'USD',
        source: 'shopify',
        items: [
          {
            sku: 'SHPFY-ITEM-1',
            name: 'Shopify Item 1',
            quantity: 2,
            unitPrice: 99.95,
            totalPrice: 199.9,
          },
        ],
      });
    });
  });
});
