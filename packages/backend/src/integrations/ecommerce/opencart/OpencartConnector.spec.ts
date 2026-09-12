import { OpencartMapper } from './OpencartMapper';
import { OpencartClient } from './OpencartClient';
import { OpencartConnector } from './OpencartConnector';
import { OpencartMarketplaceAdapter } from './OpencartMarketplaceAdapter';
import { EcommerceHttpClient, EcommerceRateLimiter } from '../core';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

describe('Opencart Integration Suite', () => {
  describe('OpencartMapper', () => {
    it('parses amounts correctly with decimal, comma, and currency symbols', () => {
      expect(OpencartMapper.parseAmount('1.250,50 TL')).toBe(1250.5);
      expect(OpencartMapper.parseAmount('1250.50')).toBe(1250.5);
      expect(OpencartMapper.parseAmount('49,99')).toBe(49.99);
      expect(OpencartMapper.parseAmount(150)).toBe(150);
      expect(OpencartMapper.parseAmount(null)).toBe(0);
    });

    it('maps order statuses correctly from standard OpenCart IDs', () => {
      expect(OpencartMapper.mapToKroptosStatus(1)).toBe('pending');
      expect(OpencartMapper.mapToKroptosStatus(2)).toBe('processing');
      expect(OpencartMapper.mapToKroptosStatus(15)).toBe('processing');
      expect(OpencartMapper.mapToKroptosStatus(3)).toBe('shipped');
      expect(OpencartMapper.mapToKroptosStatus(5)).toBe('delivered');
      expect(OpencartMapper.mapToKroptosStatus(7)).toBe('cancelled');
      expect(OpencartMapper.mapToKroptosStatus(11)).toBe('returned');
      expect(OpencartMapper.mapToKroptosStatus(10)).toBe('cancelled');
    });

    it('maps localized textual order status safely with Turkish letters', () => {
      expect(OpencartMapper.mapToKroptosStatus(undefined, 'Onay Bekliyor')).toBe('pending');
      expect(OpencartMapper.mapToKroptosStatus(undefined, 'İşleniyor')).toBe('processing');
      expect(OpencartMapper.mapToKroptosStatus(undefined, 'Kargoya Verildi')).toBe('shipped');
      expect(OpencartMapper.mapToKroptosStatus(undefined, 'Teslim Edildi')).toBe('delivered');
      expect(OpencartMapper.mapToKroptosStatus(undefined, 'İptal Edildi')).toBe('cancelled');
      expect(OpencartMapper.mapToKroptosStatus(undefined, 'İade Edildi')).toBe('returned');
    });

    it('maps raw order and addresses into unified EcommerceOrder', () => {
      const raw = {
        order_id: '1001',
        invoice_prefix: 'INV-2026-',
        invoice_no: '005',
        total: '1.500,00',
        order_status_id: '3',
        currency_code: 'TRY',
        date_added: '2026-08-10 12:00:00',
        date_modified: '2026-08-10 14:30:00',
        firstname: 'Ahmet',
        lastname: 'Yılmaz',
        email: 'ahmet@example.com',
        telephone: '05551112233',
        shipping_firstname: 'Ahmet',
        shipping_lastname: 'Yılmaz',
        shipping_address_1: 'Atatürk Cad. No: 15',
        shipping_city: 'Kadıköy',
        shipping_zone: 'İstanbul',
        shipping_postcode: '34710',
        shipping_country: 'Türkiye',
        payment_firstname: 'Ahmet',
        payment_lastname: 'Yılmaz',
        payment_address_1: 'Atatürk Cad. No: 15',
        payment_city: 'Kadıköy',
        payment_zone: 'İstanbul',
        payment_country: 'Türkiye',
        products: [
          {
            order_product_id: '501',
            product_id: '201',
            name: 'Akıllı Saat',
            model: 'WATCH-PRO-BLACK',
            quantity: 2,
            price: '750.00',
            total: '1500.00',
            options: [{ name: 'Renk', value: 'Siyah' }],
          },
        ],
      };

      const mapped = OpencartMapper.toUnifiedOrder(raw as any);
      expect(mapped.id).toBe('1001');
      expect(mapped.orderNumber).toBe('INV-2026-005');
      expect(mapped.orderStatus).toBe('open');
      expect(mapped.fulfillmentStatus).toBe('fulfilled');
      expect(mapped.financialStatus).toBe('paid');
      expect(mapped.totalPrice).toBe(1500);
      expect(mapped.customer?.firstName).toBe('Ahmet');
      expect(mapped.shippingAddress?.city).toBe('İstanbul');
      expect(mapped.items).toHaveLength(1);
      expect(mapped.items[0].sku).toBe('WATCH-PRO-BLACK');
      expect(mapped.items[0].quantity).toBe(2);
      expect(mapped.items[0].variantTitle).toBe('Renk: Siyah');
    });

    it('maps raw product and variant options into unified EcommerceProduct', () => {
      const rawProduct = {
        product_id: '301',
        name: 'Kablosuz Kulaklık',
        description: 'Yüksek kaliteli bluetooth kulaklık.',
        model: 'BT-HEADPHONE',
        sku: 'SKU-BT-301',
        price: '500.00',
        special: '450.00',
        quantity: 25,
        status: 1,
        image: 'catalog/products/earphone.jpg',
        categories: [{ category_id: 10, name: 'Elektronik' }],
        options: [
          {
            product_option_id: '1',
            option_id: '10',
            name: 'Renk',
            type: 'select',
            product_option_value: [
              {
                product_option_value_id: '101',
                option_value_id: '20',
                name: 'Beyaz',
                quantity: 15,
                price: '0.00',
                sku: 'SKU-BT-301-W',
              },
              {
                product_option_value_id: '102',
                option_value_id: '21',
                name: 'Siyah',
                quantity: 10,
                price: '50.00',
                price_prefix: '+',
                sku: 'SKU-BT-301-B',
              },
            ],
          },
        ],
      };

      const mapped = OpencartMapper.toUnifiedProduct(rawProduct as any, 'https://magaza.com');
      expect(mapped.id).toBe('301');
      expect(mapped.title).toBe('Kablosuz Kulaklık');
      expect(mapped.variants).toHaveLength(2);
      expect(mapped.variants[0].title).toBe('Renk: Beyaz');
      expect(mapped.variants[0].sku).toBe('SKU-BT-301-W');
      expect(mapped.variants[0].price).toBe(450);
      expect(mapped.variants[1].price).toBe(500); // 450 + 50
      expect(mapped.images?.[0]).toBe('https://magaza.com/image/catalog/products/earphone.jpg');
    });
  });

  describe('OpencartClient', () => {
    let httpClient: EcommerceHttpClient;
    let client: OpencartClient;

    beforeEach(() => {
      httpClient = new EcommerceHttpClient();
      client = new OpencartClient(
        { url: 'https://magaza.com', username: 'api_user', apiKey: 'secret_key' },
        httpClient,
      );
    });

    it('normalizes store URL without trailing slash', () => {
      const client1 = new OpencartClient({ url: 'magaza.com', username: 'api', apiKey: 'key' }, httpClient);
      expect(client1.getNormalizedStoreUrl()).toBe('https://magaza.com');

      const client2 = new OpencartClient({ url: 'http://test.com/shop/', username: 'api', apiKey: 'key' }, httpClient);
      expect(client2.getNormalizedStoreUrl()).toBe('http://test.com/shop');
    });

    it('logs in successfully and caches api_token', async () => {
      jest.spyOn(httpClient, 'request').mockResolvedValueOnce(
        JSON.stringify({
          success: 'Giriş başarılı',
          api_token: 'test_token_999',
        }),
      );

      const token = await client.login();
      expect(token).toBe('test_token_999');
    });

    it('throws error when login fails', async () => {
      jest.spyOn(httpClient, 'request').mockResolvedValueOnce(
        JSON.stringify({
          error: { warning: 'Uyarı: Geçersiz API anahtarı!' },
        }),
      );

      await expect(client.login()).rejects.toThrow('Uyarı: Geçersiz API anahtarı!');
    });
  });

  describe('OpencartConnector End-to-End', () => {
    let connector: OpencartConnector;
    let httpClient: EcommerceHttpClient;
    let rateLimiter: EcommerceRateLimiter;

    beforeEach(() => {
      httpClient = new EcommerceHttpClient();
      rateLimiter = new EcommerceRateLimiter();

      connector = new OpencartConnector(
        { url: 'https://magaza.com', username: 'api_user', apiKey: 'key_123' },
        httpClient,
        rateLimiter,
      );
    });

    it('tests connection successfully', async () => {
      jest.spyOn(httpClient, 'request').mockResolvedValueOnce(
        JSON.stringify({
          success: 'Başarılı',
          api_token: 'token_abc',
        }),
      );

      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('başarılı');
    });

    it('fetches orders and maps them', async () => {
      jest.spyOn(httpClient, 'request').mockImplementation(async (url) => {
        if (url.includes('api/login')) {
          return JSON.stringify({ success: 'ok', api_token: 'token_abc' });
        }
        return JSON.stringify({
          orders: [
            {
              order_id: '200',
              total: '350.00',
              order_status_id: '2',
              date_added: '2026-08-01 10:00:00',
              firstname: 'Fatma',
              lastname: 'Kaya',
              products: [
                {
                  order_product_id: '1',
                  product_id: '50',
                  name: 'Tişört',
                  model: 'TSHIRT-01',
                  quantity: 1,
                  price: '350.00',
                },
              ],
            },
          ],
        });
      });

      const orders = await connector.fetchOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe('200');
      expect(orders[0].orderStatus).toBe('open');
      expect(orders[0].financialStatus).toBe('paid');
      expect(orders[0].customer?.firstName).toBe('Fatma');
    });

    it('updates stock inventory successfully', async () => {
      jest.spyOn(httpClient, 'request').mockImplementation(async (url) => {
        if (url.includes('api/login')) {
          return JSON.stringify({ success: 'ok', api_token: 'token_abc' });
        }
        return JSON.stringify({ success: 'Stok güncellendi' });
      });

      const res = await connector.updateInventory({ sku: 'SKU-100', availableQuantity: 50 });
      expect(res.success).toBe(true);
      expect(res.newQuantity).toBe(50);
    });

    it('creates fulfillment with tracking info', async () => {
      jest.spyOn(httpClient, 'request').mockImplementation(async (url) => {
        if (url.includes('api/login')) {
          return JSON.stringify({ success: 'ok', api_token: 'token_abc' });
        }
        return JSON.stringify({ success: 'Durum güncellendi' });
      });

      const res = await connector.createFulfillment({
        orderId: '200',
        trackingNumber: 'YK123456789',
        carrierName: 'Yurtiçi Kargo',
        trackingUrl: 'https://yurticikargo.com/track/YK123456789',
      });

      expect(res.success).toBe(true);
      expect(res.carrierName).toBe('Yurtiçi Kargo');
      expect(res.trackingNumber).toBe('YK123456789');
    });
  });

  describe('OpencartMarketplaceAdapter', () => {
    it('adapts orders and products for KroptOS marketplace engine', async () => {
      const mockHttpClient = new MarketplaceHttpClient();
      const mockRateLimiter = new MarketplaceRateLimiter();

      const adapter = new OpencartMarketplaceAdapter(
        { url: 'https://magaza.com', username: 'api_user', apiKey: 'key_123' },
        mockHttpClient,
        mockRateLimiter,
      );

      expect((adapter as any).displayName).toBe('OpenCart');
    });
  });
});
