import { IdeasoftConnector } from './IdeasoftConnector';
import { IdeasoftMapper } from './IdeasoftMapper';
import { IdeasoftMarketplaceAdapter } from './IdeasoftMarketplaceAdapter';
import { EcommerceHttpClient, EcommerceRateLimiter } from '../core';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';
import { IdeasoftRawOrder, IdeasoftRawProduct } from './IdeasoftTypes';

describe('Ideasoft Integration Suite', () => {
  describe('IdeasoftMapper', () => {
    it('parses amounts correctly with decimal and thousand separators', () => {
      expect(IdeasoftMapper.parseAmount('249.90')).toBe(249.9);
      expect(IdeasoftMapper.parseAmount('1.250,75')).toBe(1250.75);
      expect(IdeasoftMapper.parseAmount(99.5)).toBe(99.5);
      expect(IdeasoftMapper.parseAmount(undefined)).toBe(0);
      expect(IdeasoftMapper.parseAmount(null)).toBe(0);
    });

    it('maps IdeaSoft order statuses to KroptOS unified status', () => {
      expect(IdeasoftMapper.mapToKroptosStatus('new')).toBe('pending');
      expect(IdeasoftMapper.mapToKroptosStatus('waiting_approval')).toBe('pending');
      expect(IdeasoftMapper.mapToKroptosStatus('approved')).toBe('processing');
      expect(IdeasoftMapper.mapToKroptosStatus('preparing')).toBe('processing');
      expect(IdeasoftMapper.mapToKroptosStatus('shipped')).toBe('shipped');
      expect(IdeasoftMapper.mapToKroptosStatus('delivered')).toBe('delivered');
      expect(IdeasoftMapper.mapToKroptosStatus('cancelled')).toBe('cancelled');
      expect(IdeasoftMapper.mapToKroptosStatus('refunded')).toBe('returned');
    });

    it('never maps unknown status to terminal status (falls back to pending)', () => {
      expect(IdeasoftMapper.mapToKroptosStatus('unknown_carrier_wait')).toBe('pending');
      expect(IdeasoftMapper.mapToKroptosStatus('random_custom_status')).toBe('pending');
      expect(IdeasoftMapper.mapOrderStatus('custom_status')).toBe('open');
    });

    it('maps order with addresses and line items correctly', () => {
      const mockOrder: IdeasoftRawOrder = {
        id: 501,
        orderNumber: 'IDE-501',
        status: 'approved',
        paymentStatus: 'paid',
        currency: 'TRY',
        totalPrice: '500.00',
        customerFirstname: 'Zeynep',
        customerSurname: 'Demir',
        customerEmail: 'zeynep@example.com',
        customerPhone: '05321112233',
        createdAt: '2026-09-04 10:00:00',
        shippingAddress: {
          firstname: 'Zeynep',
          surname: 'Demir',
          address: 'Bağdat Cad. No: 12',
          city: 'İstanbul',
          district: 'Kadıköy',
          country: 'TR',
          postcode: '34720',
          phoneNumber: '05321112233',
        },
        orderItems: [
          {
            id: 88,
            productName: 'İpek Şal',
            productSku: 'SAL-01',
            productPrice: '250.00',
            orderQuantity: 2,
            totalPrice: '500.00',
          },
        ],
      };

      const mapped = IdeasoftMapper.toEcommerceOrder(mockOrder);
      expect(mapped.id).toBe('501');
      expect(mapped.orderNumber).toBe('IDE-501');
      expect(mapped.orderStatus).toBe('open');
      expect(mapped.financialStatus).toBe('paid');
      expect(mapped.totalPrice).toBe(500);
      expect(mapped.customer?.fullName).toBe('Zeynep Demir');
      expect(mapped.shippingAddress?.city).toBe('İstanbul');
      expect(mapped.shippingAddress?.province).toBe('Kadıköy');
      expect(mapped.items).toHaveLength(1);
      expect(mapped.items[0].sku).toBe('SAL-01');
      expect(mapped.items[0].quantity).toBe(2);
    });

    it('maps products correctly', () => {
      const rawProduct: IdeasoftRawProduct = {
        id: 12,
        name: 'Deri Cüzdan',
        sku: 'CUZ-01',
        barcode: '8680001234567',
        stockAmount: 45,
        status: 1,
        price1: '350.00',
        currency: { abbr: 'TRY' },
      };

      const mapped = IdeasoftMapper.toEcommerceProduct(rawProduct);
      expect(mapped.id).toBe('12');
      expect(mapped.title).toBe('Deri Cüzdan');
      expect(mapped.status).toBe('active');
      expect(mapped.variants[0].sku).toBe('CUZ-01');
      expect(mapped.variants[0].barcode).toBe('8680001234567');
      expect(mapped.variants[0].inventoryQuantity).toBe(45);
      expect(mapped.variants[0].price).toBe(350);
    });
  });

  describe('IdeasoftConnector', () => {
    let httpClient: jest.Mocked<EcommerceHttpClient>;
    let rateLimiter: jest.Mocked<EcommerceRateLimiter>;

    beforeEach(() => {
      httpClient = {
        request: jest.fn(),
        json: jest.fn(),
      } as any;

      rateLimiter = {
        throttle: jest.fn().mockResolvedValue(undefined),
      } as any;
    });

    it('normalizes storeDomain into an absolute HTTPS myideasoft URL', () => {
      const c1 = new IdeasoftConnector({ storeDomain: 'modabutik' }, httpClient, rateLimiter);
      expect(c1.getNormalizedStoreUrl()).toBe('https://modabutik.myideasoft.com');

      const c2 = new IdeasoftConnector({ storeDomain: 'modabutik.myideasoft.com' }, httpClient, rateLimiter);
      expect(c2.getNormalizedStoreUrl()).toBe('https://modabutik.myideasoft.com');

      const c3 = new IdeasoftConnector({ storeDomain: 'https://ozelmagaza.com/' }, httpClient, rateLimiter);
      expect(c3.getNormalizedStoreUrl()).toBe('https://ozelmagaza.com');
    });

    it('tests connection successfully when API returns products', async () => {
      const connector = new IdeasoftConnector(
        { storeDomain: 'teststore', accessToken: 'test_token_123' },
        httpClient,
        rateLimiter,
      );

      httpClient.json.mockResolvedValueOnce([{ id: 1, name: 'Sample' }] as any);

      const res = await connector.testConnection();
      expect(res.success).toBe(true);
      expect(res.message).toContain('başarıyla doğrulandı');
    });

    it('fails test connection cleanly when access token is missing', async () => {
      const connector = new IdeasoftConnector(
        { storeDomain: 'teststore' },
        httpClient,
        rateLimiter,
      );

      const res = await connector.testConnection();
      expect(res.success).toBe(false);
      expect(res.message).toContain('kimlik bilgileri girilmemiş');
    });

    it('fetches orders and maps them', async () => {
      const connector = new IdeasoftConnector(
        { storeDomain: 'teststore', accessToken: 'test_token_123' },
        httpClient,
        rateLimiter,
      );

      httpClient.json.mockResolvedValueOnce([
        {
          id: 101,
          orderNumber: 'ORD-101',
          status: 'new',
          totalPrice: '120.00',
          orderItems: [{ id: 1, productName: 'Test Ürün', productSku: 'SKU-1', orderQuantity: 1, productPrice: '120.00' }],
        },
      ] as any);

      const orders = await connector.fetchOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].orderNumber).toBe('ORD-101');
      expect(orders[0].orderStatus).toBe('open');
    });

    it('updates stock inventory via SKU', async () => {
      const connector = new IdeasoftConnector(
        { storeDomain: 'teststore', accessToken: 'test_token_123' },
        httpClient,
        rateLimiter,
      );

      // 1. Search product by SKU
      httpClient.json.mockResolvedValueOnce([{ id: 77, sku: 'TEST-SKU' }] as any);
      // 2. PUT update
      httpClient.json.mockResolvedValueOnce({ id: 77, stockAmount: 25 } as any);

      const res = await connector.updateInventory({ sku: 'TEST-SKU', availableQuantity: 25 });
      expect(res.success).toBe(true);
      expect(res.newQuantity).toBe(25);
    });
  });

  describe('IdeasoftMarketplaceAdapter', () => {
    let mpHttpClient: jest.Mocked<MarketplaceHttpClient>;
    let mpRateLimiter: jest.Mocked<MarketplaceRateLimiter>;

    beforeEach(() => {
      mpHttpClient = {
        request: jest.fn(),
      } as any;

      mpRateLimiter = {
        throttle: jest.fn().mockResolvedValue(undefined),
      } as any;
    });

    it('adapts testConnection for MarketplaceConnector callers', async () => {
      const adapter = new IdeasoftMarketplaceAdapter(
        { storeDomain: 'teststore', accessToken: 'test_token_123' },
        mpHttpClient,
        mpRateLimiter,
      );

      // Mock probe
      jest.spyOn((adapter as any).delegate, 'testConnection').mockResolvedValueOnce({
        success: true,
        message: 'İdeaSoft bağlantısı doğrulandı',
      });

      const res = await adapter.testConnection();
      expect(res.success).toBe(true);
      expect(res.mode).toBe('live');
    });
  });
});
