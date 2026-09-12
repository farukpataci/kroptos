import { ShopifyConnector } from './ShopifyConnector';
import { EcommerceHttpClient } from '../core/EcommerceHttpClient';
import { EcommerceRateLimiter } from '../core/EcommerceRateLimiter';
import { ShopifyMapper } from './ShopifyMapper';
import { ShopifyStatusMap } from './ShopifyStatusMap';

describe('ShopifyConnector', () => {
  let httpClient: EcommerceHttpClient;
  let rateLimiter: EcommerceRateLimiter;

  beforeEach(() => {
    httpClient = new EcommerceHttpClient();
    rateLimiter = new EcommerceRateLimiter();
  });

  const validCreds = {
    accessToken: 'shpat_test_token_12345',
  };

  const validSettings = {
    'general.shopDomain': 'test-store.myshopify.com',
  };

  describe('ShopifyMapper.parseAmount', () => {
    it('parses major unit amounts correctly', () => {
      expect(ShopifyMapper.parseAmount('99.95')).toBe(99.95);
      expect(ShopifyMapper.parseAmount(99.95)).toBe(99.95);
      expect(ShopifyMapper.parseAmount('0')).toBe(0);
      expect(ShopifyMapper.parseAmount(null)).toBe(0);
      expect(ShopifyMapper.parseAmount('120,50')).toBe(120.5);
    });
  });

  describe('ShopifyStatusMap', () => {
    it('maps financial statuses correctly', () => {
      expect(ShopifyStatusMap.mapFinancialStatus('paid')).toBe('paid');
      expect(ShopifyStatusMap.mapFinancialStatus('authorized')).toBe('authorized');
      expect(ShopifyStatusMap.mapFinancialStatus('partially_paid')).toBe('partially_paid');
      expect(ShopifyStatusMap.mapFinancialStatus('refunded')).toBe('refunded');
      expect(ShopifyStatusMap.mapFinancialStatus('unknown')).toBe('pending');
    });

    it('maps fulfillment statuses correctly', () => {
      expect(ShopifyStatusMap.mapFulfillmentStatus('fulfilled')).toBe('fulfilled');
      expect(ShopifyStatusMap.mapFulfillmentStatus('partial')).toBe('partially_fulfilled');
      expect(ShopifyStatusMap.mapFulfillmentStatus(null)).toBe('unfulfilled');
    });

    it('maps order statuses correctly', () => {
      expect(ShopifyStatusMap.mapOrderStatus('2024-01-01T00:00:00Z', null)).toBe('cancelled');
      expect(ShopifyStatusMap.mapOrderStatus(null, '2024-01-01T00:00:00Z')).toBe('closed');
      expect(ShopifyStatusMap.mapOrderStatus(null, null)).toBe('open');
    });
  });

  describe('shopDomain handling', () => {
    it('returns failure result if shopDomain is missing', async () => {
      const connector = new ShopifyConnector(validCreds, httpClient, rateLimiter, {});
      const res = await connector.testConnection();
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/shopDomain/i);
    });

    it('normalises shopDomain cleanly and tests connection successfully', async () => {
      const connector = new ShopifyConnector(
        validCreds,
        httpClient,
        rateLimiter,
        { 'general.shopDomain': 'https://my-shop.myshopify.com/' },
      );

      jest.spyOn(httpClient, 'json').mockResolvedValue({
        shop: { id: 1, name: 'My Test Shop', myshopify_domain: 'my-shop.myshopify.com', currency: 'USD' },
      });

      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.shopName).toBe('My Test Shop');
      expect(httpClient.json).toHaveBeenCalledWith(
        'https://my-shop.myshopify.com/admin/api/2024-01/shop.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Shopify-Access-Token': 'shpat_test_token_12345',
          }),
        }),
      );
    });
  });

  describe('fetchOrders', () => {
    it('fetches and maps Shopify orders into EcommerceOrder', async () => {
      const connector = new ShopifyConnector(validCreds, httpClient, rateLimiter, validSettings);

      const mockShopifyOrders = {
        orders: [
          {
            id: 991,
            order_number: 1005,
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:30:00Z',
            financial_status: 'paid',
            fulfillment_status: null,
            total_price: '199.90',
            subtotal_price: '199.90',
            total_tax: '0.00',
            total_discounts: '0.00',
            currency: 'USD',
            customer: {
              id: 55,
              first_name: 'Jane',
              last_name: 'Doe',
              email: 'jane@example.com',
            },
            shipping_address: {
              first_name: 'Jane',
              last_name: 'Doe',
              address1: '123 Main St',
              city: 'New York',
              country: 'United States',
              country_code: 'US',
              zip: '10001',
            },
            line_items: [
              {
                id: 111,
                product_id: 88,
                variant_id: 881,
                sku: 'SHPFY-ITEM-1',
                title: 'Shopify Item 1',
                quantity: 2,
                price: '99.95',
                total_discount: '0.00',
              },
            ],
          },
        ],
      };

      jest.spyOn(httpClient, 'json').mockResolvedValue(mockShopifyOrders);

      const orders = await connector.fetchOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe('991');
      expect(orders[0].orderNumber).toBe('1005');
      expect(orders[0].provider).toBe('SHOPIFY');
      expect(orders[0].customer?.fullName).toBe('Jane Doe');
      expect(orders[0].customer?.email).toBe('jane@example.com');
      expect(orders[0].financialStatus).toBe('paid');
      expect(orders[0].fulfillmentStatus).toBe('unfulfilled');
      expect(orders[0].totalPrice).toBe(199.9);
      expect(orders[0].currency).toBe('USD');
      expect(orders[0].items).toHaveLength(1);
      expect(orders[0].items[0].sku).toBe('SHPFY-ITEM-1');
      expect(orders[0].items[0].quantity).toBe(2);
      expect(orders[0].items[0].unitPrice).toBe(99.95);
    });
  });

  describe('getOrder', () => {
    it('fetches a single order by ID', async () => {
      const connector = new ShopifyConnector(validCreds, httpClient, rateLimiter, validSettings);
      jest.spyOn(httpClient, 'json').mockResolvedValue({
        order: {
          id: 12345,
          order_number: 1001,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:30:00Z',
          financial_status: 'paid',
          fulfillment_status: 'fulfilled',
          total_price: '50.00',
          subtotal_price: '50.00',
          total_tax: '0.00',
          total_discounts: '0.00',
          currency: 'USD',
          line_items: [],
        },
      });

      const order = await connector.getOrder('12345');
      expect(order.id).toBe('12345');
      expect(order.orderNumber).toBe('1001');
      expect(order.fulfillmentStatus).toBe('fulfilled');
    });
  });

  describe('createFulfillment', () => {
    it('creates a fulfillment on Shopify with tracking info', async () => {
      const connector = new ShopifyConnector(validCreds, httpClient, rateLimiter, validSettings);

      jest.spyOn(httpClient, 'json')
        .mockResolvedValueOnce({
          fulfillment_orders: [{ id: 8888, status: 'open' }],
        })
        .mockResolvedValueOnce({
          fulfillment: { id: 9999, status: 'success' },
        });

      const result = await connector.createFulfillment({
        orderId: '12345',
        trackingNumber: 'TRK-123456789',
        carrierName: 'Yurtici Kargo',
        trackingUrl: 'https://yurticikargo.com/track/TRK-123456789',
      });

      expect(result.success).toBe(true);
      expect(result.fulfillmentId).toBe('9999');
      expect(result.trackingNumber).toBe('TRK-123456789');
      expect(result.carrierName).toBe('Yurtici Kargo');
    });

    it('returns error if no open fulfillment order is found', async () => {
      const connector = new ShopifyConnector(validCreds, httpClient, rateLimiter, validSettings);

      jest.spyOn(httpClient, 'json').mockResolvedValueOnce({
        fulfillment_orders: [{ id: 8888, status: 'closed' }],
      });

      const result = await connector.createFulfillment({
        orderId: '12345',
        trackingNumber: 'TRK-123',
      });

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/açık fulfillment emri bulunamadı/);
    });
  });

  describe('fetchProducts', () => {
    it('fetches products and transforms to EcommerceProduct', async () => {
      const connector = new ShopifyConnector(validCreds, httpClient, rateLimiter, validSettings);

      jest.spyOn(httpClient, 'json').mockResolvedValue({
        products: [
          {
            id: 777,
            title: 'T-Shirt',
            body_html: '<p>Cotton shirt</p>',
            vendor: 'TestBrand',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            variants: [
              {
                id: 7771,
                product_id: 777,
                title: 'Large / Black',
                price: '29.99',
                sku: 'TSHIRT-L-BLK',
                inventory_quantity: 45,
              },
            ],
          },
        ],
      });

      const products = await connector.fetchProducts();
      expect(products).toHaveLength(1);
      expect(products[0].id).toBe('777');
      expect(products[0].title).toBe('T-Shirt');
      expect(products[0].variants).toHaveLength(1);
      expect(products[0].variants[0].sku).toBe('TSHIRT-L-BLK');
      expect(products[0].variants[0].price).toBe(29.99);
      expect(products[0].variants[0].inventoryQuantity).toBe(45);
    });
  });

  describe('updateInventory', () => {
    it('successfully reports inventory update when inventory item exists', async () => {
      const connector = new ShopifyConnector(validCreds, httpClient, rateLimiter, validSettings);

      jest.spyOn(httpClient, 'json').mockResolvedValue({
        products: [
          {
            id: 1,
            variants: [{ sku: 'SKU-ABC', inventory_item_id: 555 }],
          },
        ],
      });

      const res = await connector.updateInventory({ sku: 'SKU-ABC', availableQuantity: 10 });
      expect(res.success).toBe(true);
      expect(res.newQuantity).toBe(10);
    });
  });
});
