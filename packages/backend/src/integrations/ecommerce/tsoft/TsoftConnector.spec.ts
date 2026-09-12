import { TsoftConnector } from './TsoftConnector';
import { TsoftMapper } from './TsoftMapper';
import { TsoftClient } from './TsoftClient';
import { TsoftMarketplaceAdapter } from './TsoftMarketplaceAdapter';
import { EcommerceHttpClient, EcommerceRateLimiter } from '../core';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';

describe('Tsoft Integration Suite', () => {
  describe('TsoftMapper', () => {
    it('parses amounts correctly with decimal and comma formats', () => {
      expect(TsoftMapper.parseAmount('250.75')).toBe(250.75);
      expect(TsoftMapper.parseAmount('1.250,50')).toBe(1250.5);
      expect(TsoftMapper.parseAmount(89)).toBe(89);
      expect(TsoftMapper.parseAmount('')).toBe(0);
      expect(TsoftMapper.parseAmount(null)).toBe(0);
    });

    it('maps order statuses correctly to KroptOS unified status', () => {
      expect(TsoftMapper.mapToKroptosStatus('Beklemede')).toBe('pending');
      expect(TsoftMapper.mapToKroptosStatus('Ödeme Bekliyor')).toBe('pending');
      expect(TsoftMapper.mapToKroptosStatus('Onay Bekliyor')).toBe('pending');
      expect(TsoftMapper.mapToKroptosStatus('Onaylandı')).toBe('processing');
      expect(TsoftMapper.mapToKroptosStatus('Hazırlanıyor')).toBe('processing');
      expect(TsoftMapper.mapToKroptosStatus('Kargoya Verildi')).toBe('shipped');
      expect(TsoftMapper.mapToKroptosStatus('Teslim Edildi')).toBe('delivered');
      expect(TsoftMapper.mapToKroptosStatus('İptal Edildi')).toBe('cancelled');
      expect(TsoftMapper.mapToKroptosStatus('İade Edildi')).toBe('returned');
    });

    it('maps order details and addresses into unified EcommerceOrder', () => {
      const mockRaw = {
        OrderId: '101',
        OrderCode: 'TSOFT-101',
        OrderStatus: 'Onaylandı',
        PaymentStatus: 'Ödendi',
        Total: '850.00',
        OrderDate: '2026-09-04T12:00:00Z',
        CustomerName: 'Mert Aksoy',
        CustomerEmail: 'mert@example.com',
        OrderDetails: [
          {
            OrderDetailId: '501',
            ProductCode: 'TSH-BLK-L',
            ProductName: 'Siyah Tişört L',
            Quantity: 2,
            Price: '425.00',
          },
        ],
        ShippingAddress: {
          Name: 'Mert Aksoy',
          Address: 'İnönü Mah. No: 10',
          City: 'İzmir',
          District: 'Bornova',
          PostalCode: '35040',
          Phone: '05330000000',
        },
      };

      const order = TsoftMapper.toUnifiedOrder(mockRaw);
      expect(order.orderNumber).toBe('TSOFT-101');
      expect(order.orderStatus).toBe('open');
      expect(order.fulfillmentStatus).toBe('unfulfilled');
      expect(order.financialStatus).toBe('paid');
      expect(order.totalPrice).toBe(850);
      expect(order.items).toHaveLength(1);
      expect(order.items[0].sku).toBe('TSH-BLK-L');
      expect(order.shippingAddress?.city).toBe('İzmir');
    });
  });

  describe('TsoftClient', () => {
    let httpClient: EcommerceHttpClient;
    let client: TsoftClient;

    beforeEach(() => {
      httpClient = new EcommerceHttpClient();
      client = new TsoftClient(
        {
          storeDomain: 'https://demo.tsoft.com.tr',
          username: 'api_user',
          password: 'api_password',
        },
        httpClient,
      );
    });

    it('normalizes store url correctly', () => {
      expect(client.getNormalizedStoreUrl()).toBe('https://demo.tsoft.com.tr');

      const client2 = new TsoftClient(
        { storeDomain: 'magaza.com', username: 'u', password: 'p' },
        httpClient,
      );
      expect(client2.getNormalizedStoreUrl()).toBe('https://magaza.com');
    });

    it('logs in and saves token', async () => {
      const mockAuth = JSON.stringify({
        success: true,
        data: [{ token: 'abc-token-123' }],
      });

      jest.spyOn(httpClient, 'request').mockResolvedValue(mockAuth);

      const token = await client.login();
      expect(token).toBe('abc-token-123');
    });

    it('throws error when login fails', async () => {
      const mockAuth = JSON.stringify({
        success: false,
        message: ['Hatalı kullanıcı adı veya parola.'],
      });

      jest.spyOn(httpClient, 'request').mockResolvedValue(mockAuth);

      await expect(client.login()).rejects.toThrow(/T-Soft giriş başarısız/);
    });
  });

  describe('TsoftConnector End-to-End', () => {
    let httpClient: EcommerceHttpClient;
    let rateLimiter: EcommerceRateLimiter;
    let connector: TsoftConnector;

    beforeEach(() => {
      httpClient = new EcommerceHttpClient();
      rateLimiter = new EcommerceRateLimiter();
      connector = new TsoftConnector(
        {
          storeDomain: 'https://demo.tsoft.com.tr',
          username: 'api_user',
          password: 'api_password',
        },
        httpClient,
        rateLimiter,
      );
    });

    it('tests connection successfully', async () => {
      jest.spyOn(httpClient, 'request').mockImplementation(async (url) => {
        if (url.includes('/auth/login')) {
          return JSON.stringify({ success: true, data: [{ token: 'test-token' }] });
        }
        return JSON.stringify({ success: true, data: [{ ProductId: '1' }] });
      });

      const res = await connector.testConnection();
      expect(res.success).toBe(true);
      expect(res.message).toContain('T-Soft bağlantısı başarılı');
    });

    it('fetches orders and maps them', async () => {
      jest.spyOn(httpClient, 'request').mockImplementation(async (url) => {
        if (url.includes('/auth/login')) {
          return JSON.stringify({ success: true, data: [{ token: 'test-token' }] });
        }
        return JSON.stringify({
          success: true,
          data: [
            {
              OrderId: '301',
              OrderCode: 'ORD-301',
              OrderStatus: 'Kargoya Verildi',
              Total: '500',
              CargoTrackingCode: 'MNG-12345',
              CargoCompany: 'MNG Kargo',
              OrderDetails: [{ ProductCode: 'SKU-1', Quantity: 1, Price: '500' }],
            },
          ],
        });
      });

      const orders = await connector.fetchOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].orderNumber).toBe('ORD-301');
      expect(orders[0].fulfillmentStatus).toBe('fulfilled');
      expect(orders[0].rawPayload).toEqual({ trackingNumber: 'MNG-12345', trackingCompany: 'MNG Kargo' });
    });

    it('updates stock inventory successfully', async () => {
      jest.spyOn(httpClient, 'request').mockImplementation(async (url) => {
        if (url.includes('/auth/login')) {
          return JSON.stringify({ success: true, data: [{ token: 'test-token' }] });
        }
        return JSON.stringify({ success: true, data: [{ success: true }] });
      });

      const res = await connector.updateInventory({ sku: 'SKU-1', availableQuantity: 50 });
      expect(res.success).toBe(true);
      expect(res.newQuantity).toBe(50);
    });

    it('creates fulfillment with tracking info', async () => {
      jest.spyOn(httpClient, 'request').mockImplementation(async (url) => {
        if (url.includes('/auth/login')) {
          return JSON.stringify({ success: true, data: [{ token: 'test-token' }] });
        }
        return JSON.stringify({ success: true });
      });

      const res = await connector.createFulfillment({
        orderId: '301',
        trackingNumber: 'MNG-12345',
        carrierName: 'MNG Kargo',
      });

      expect(res.success).toBe(true);
      expect(res.fulfillmentId).toBe('301-fulfillment');
      expect(res.trackingNumber).toBe('MNG-12345');
    });
  });

  describe('TsoftMarketplaceAdapter', () => {
    it('adapts orders and products for KroptOS marketplace engine', async () => {
      const marketHttp = new MarketplaceHttpClient();
      const marketLimiter = new MarketplaceRateLimiter();

      const adapter = new TsoftMarketplaceAdapter(
        { storeDomain: 'https://demo.tsoft.com.tr', username: 'u', password: 'p' },
        marketHttp,
        marketLimiter,
      );

      jest.spyOn(EcommerceHttpClient.prototype, 'request').mockImplementation(async (url) => {
        if (url.includes('/auth/login')) {
          return JSON.stringify({ success: true, data: [{ token: 'test-token' }] });
        }
        return JSON.stringify({
          success: true,
          data: [
            {
              OrderId: '900',
              OrderCode: 'ORD-900',
              OrderStatus: 'Onaylandı',
              Total: '150',
            },
          ],
        });
      });

      const orders = await adapter.getOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].source).toBe('tsoft');
      expect(orders[0].orderNumber).toBe('ORD-900');
    });
  });
});
