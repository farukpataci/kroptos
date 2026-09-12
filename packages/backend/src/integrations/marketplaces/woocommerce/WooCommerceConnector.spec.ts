import { WooCommerceMapper } from './WooCommerceMapper';
import { WooCommerceWebhook } from './WooCommerceWebhook';
import { WooUrlGuard } from './WooUrlGuard';
import { WooCommerceConnector } from './WooCommerceConnector';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { WooCommerceRawOrder, WooCommerceRawProduct } from './WooCommerceTypes';

describe('WooCommerce Integration Suite', () => {
  describe('WooCommerceMapper', () => {
    it('parses amounts accurately from strings and numbers', () => {
      expect(WooCommerceMapper.parseAmount('49.90')).toBe(49.9);
      expect(WooCommerceMapper.parseAmount('129,50')).toBe(129.5);
      expect(WooCommerceMapper.parseAmount(19.99)).toBe(19.99);
      expect(WooCommerceMapper.parseAmount(undefined)).toBe(0);
      expect(WooCommerceMapper.parseAmount(null)).toBe(0);
      expect(WooCommerceMapper.parseAmount('')).toBe(0);
    });

    it('maps standard WooCommerce statuses correctly', () => {
      expect(WooCommerceMapper.mapOrderStatus('pending')).toBe('pending');
      expect(WooCommerceMapper.mapOrderStatus('processing')).toBe('processing');
      expect(WooCommerceMapper.mapOrderStatus('on-hold')).toBe('pending');
      expect(WooCommerceMapper.mapOrderStatus('completed')).toBe('delivered');
      expect(WooCommerceMapper.mapOrderStatus('cancelled')).toBe('cancelled');
      expect(WooCommerceMapper.mapOrderStatus('refunded')).toBe('returned');
      expect(WooCommerceMapper.mapOrderStatus('failed')).toBe('cancelled');
    });

    it('skips drafts and trash orders', () => {
      expect(WooCommerceMapper.mapOrderStatus('checkout-draft')).toBeNull();
      expect(WooCommerceMapper.mapOrderStatus('trash')).toBeNull();
      expect(WooCommerceMapper.mapOrderStatus('auto-draft')).toBeNull();
    });

    it('NEVER maps an unknown status to a terminal state (falls back to pending)', () => {
      expect(WooCommerceMapper.mapOrderStatus('custom_status_xyz')).toBe('pending');
      expect(WooCommerceMapper.mapOrderStatus('custom_processing')).toBe('pending');
      expect(WooCommerceMapper.mapOrderStatus('shipped_by_custom_carrier')).toBe('pending');
    });

    it('maps order and extracts structured carrier address', () => {
      const mockOrder: WooCommerceRawOrder = {
        id: 1001,
        number: '1001',
        status: 'processing',
        currency: 'TRY',
        date_created: '2026-09-04T10:00:00',
        date_created_gmt: '2026-09-04T10:00:00Z',
        date_modified: '2026-09-04T10:00:00',
        date_modified_gmt: '2026-09-04T10:00:00Z',
        total: '350.50',
        line_items: [
          {
            id: 201,
            name: 'Denim Ceket',
            product_id: 50,
            quantity: 2,
            sku: 'CEKET-01',
            price: '175.25',
            total: '350.50',
          },
        ],
        shipping: {
          first_name: 'Ahmet',
          last_name: 'Yılmaz',
          address_1: 'Atatürk Cad. No: 15 D: 4',
          city: 'Kadıköy',
          state: 'İstanbul',
          postcode: '34710',
          country: 'TR',
          phone: '05551234567',
        },
        billing: {
          first_name: 'Ahmet',
          last_name: 'Yılmaz',
          email: 'ahmet@example.com',
          phone: '05551234567',
        },
      };

      const mapped = WooCommerceMapper.toMarketplaceOrder(mockOrder);
      expect(mapped).toBeDefined();
      expect(mapped!.orderNumber).toBe('1001');
      expect(mapped!.customerName).toBe('Ahmet Yılmaz');
      expect(mapped!.customerEmail).toBe('ahmet@example.com');
      expect(mapped!.status).toBe('processing');
      expect(mapped!.totalAmount).toBe(350.5);
      expect(mapped!.currency).toBe('TRY');
      expect(mapped!.shippingCity).toBe('Kadıköy');
      expect(mapped!.shippingDistrict).toBe('İstanbul');
      expect(mapped!.shippingPostalCode).toBe('34710');
      expect(mapped!.shippingCountryCode).toBe('TR');
      expect(mapped!.items).toHaveLength(1);
      expect(mapped!.items[0].sku).toBe('CEKET-01');
      expect(mapped!.items[0].quantity).toBe(2);
    });

    it('maps variable products with variation SKU and attributes', () => {
      const parentProduct: WooCommerceRawProduct = {
        id: 77,
        name: 'Basic T-Shirt',
        type: 'variable',
        status: 'publish',
        sku: 'TSHIRT-BASE',
        regular_price: '99.00',
      };

      const variation = {
        id: 105,
        sku: 'TSHIRT-M-BLACK',
        regular_price: '99.00',
        stock_quantity: 15,
        stock_status: 'instock' as const,
        attributes: [
          { id: 1, name: 'Beden', option: 'M' },
          { id: 2, name: 'Renk', option: 'Siyah' },
        ],
      };

      const mapped = WooCommerceMapper.toMarketplaceProduct(parentProduct, variation);
      expect(mapped.sku).toBe('TSHIRT-M-BLACK');
      expect(mapped.name).toContain('Basic T-Shirt');
      expect(mapped.name).toContain('M Siyah');
      expect(mapped.stockQuantity).toBe(15);
      expect(mapped.price).toBe(99);
    });
  });

  describe('WooUrlGuard', () => {
    it('normalizes valid HTTPS url and strips trailing slash', async () => {
      const url = await WooUrlGuard.validateAndNormalize('https://example.com/shop/');
      expect(url).toBe('https://example.com');
    });

    it('rejects HTTP in non-dev mode', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(WooUrlGuard.validateAndNormalize('http://insecure-site.com')).rejects.toThrow(
          'HTTPS protokolü zorunludur',
        );
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('rejects private and loopback IPs (SSRF protection)', async () => {
      await expect(WooUrlGuard.validateAndNormalize('https://127.0.0.1')).rejects.toThrow();
      await expect(WooUrlGuard.validateAndNormalize('https://10.0.0.1')).rejects.toThrow();
      await expect(WooUrlGuard.validateAndNormalize('https://192.168.1.1')).rejects.toThrow();
      await expect(WooUrlGuard.validateAndNormalize('https://169.254.169.254')).rejects.toThrow();
    });
  });

  describe('WooCommerceWebhook', () => {
    const secret = 'test-webhook-secret-key-32-bytes-long';
    const payload = JSON.stringify({ id: 1001, status: 'processing' });
    const crypto = require('crypto');
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64');

    it('validates a correct HMAC signature', () => {
      const isValid = WooCommerceWebhook.verifySignature(payload, validSignature, secret);
      expect(isValid).toBe(true);
    });

    it('rejects an invalid signature or tampered body', () => {
      const tamperedBody = JSON.stringify({ id: 1001, status: 'completed' });
      expect(WooCommerceWebhook.verifySignature(tamperedBody, validSignature, secret)).toBe(false);
      expect(WooCommerceWebhook.verifySignature(payload, 'invalid-signature', secret)).toBe(false);
    });

    it('deduplicates delivery IDs', () => {
      const deliveryId = 'deliv_abc_123';
      expect(WooCommerceWebhook.isDuplicateDelivery(deliveryId)).toBe(false);
      expect(WooCommerceWebhook.isDuplicateDelivery(deliveryId)).toBe(true);
    });
  });

  describe('WooCommerceConnector', () => {
    let httpClient: jest.Mocked<MarketplaceHttpClient>;
    let rateLimiter: jest.Mocked<MarketplaceRateLimiter>;

    beforeEach(() => {
      httpClient = {
        request: jest.fn(),
      } as any;

      rateLimiter = {
        throttle: jest.fn().mockResolvedValue(undefined),
      } as any;
    });

    it('requires consumerKey and consumerSecret', async () => {
      const connector = new WooCommerceConnector(
        { baseUrl: 'https://example.com' },
        httpClient,
        rateLimiter,
      );

      await expect(connector.getOrders()).rejects.toThrow('kimlik bilgileri eksik');
    });

    it('tests connection successfully when root index and system status pass', async () => {
      const connector = new WooCommerceConnector(
        {
          baseUrl: 'https://example.com',
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        },
        httpClient,
        rateLimiter,
      );

      // Root WP probe
      httpClient.request.mockResolvedValueOnce({
        namespaces: ['wc/v3'],
      } as any);

      // System status probe
      httpClient.request.mockResolvedValueOnce({
        environment: { version: '8.5.0' },
        settings: { currency: 'TRY', prices_include_tax: true },
      } as any);

      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('WooCommerce bağlantısı başarılı');
      expect(result.message).toContain('WC: 8.5.0');
    });

    it('diagnoses missing permalinks when root index returns 404', async () => {
      const connector = new WooCommerceConnector(
        {
          baseUrl: 'https://example.com',
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        },
        httpClient,
        rateLimiter,
      );

      const notFoundErr: any = new Error('Not Found');
      notFoundErr.upstreamStatus = 404;
      httpClient.request.mockRejectedValueOnce(notFoundErr);

      const result = await connector.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Kalıcı Bağlantılar');
    });

    it('fetches and maps orders with settings status map and prefix', async () => {
      const connector = new WooCommerceConnector(
        {
          baseUrl: 'https://example.com',
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        },
        httpClient,
        rateLimiter,
        {
          'orders.numberPrefix': 'WOO-',
        },
      );

      httpClient.request.mockResolvedValueOnce([
        {
          id: 550,
          number: '550',
          status: 'processing',
          currency: 'TRY',
          total: '100.00',
          line_items: [
            { id: 1, name: 'Kazak', sku: 'KZK-1', quantity: 1, total: '100.00' },
          ],
        },
      ] as any);

      const orders = await connector.getOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].orderNumber).toBe('WOO-550');
      expect(orders[0].items[0].sku).toBe('KZK-1');
    });
  });
});
