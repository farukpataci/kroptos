import { IkasConnector } from './IkasConnector';
import { IkasMapper } from './IkasMapper';
import { IkasMarketplaceAdapter } from './IkasMarketplaceAdapter';
import { EcommerceHttpClient, EcommerceRateLimiter } from '../core';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../../marketplaces/core/MarketplaceRateLimiter';
import { IkasRawOrder, IkasRawProduct } from './IkasTypes';

describe('Ikas Integration Suite', () => {
  describe('IkasMapper', () => {
    it('maps Ikas order statuses to KroptOS unified status', () => {
      expect(IkasMapper.mapOrderStatus('WAITING_FOR_PAYMENT')).toBe('open');
      expect(IkasMapper.mapOrderStatus('WAITING_FOR_SHIPMENT')).toBe('open');
      expect(IkasMapper.mapOrderStatus('PREPARING')).toBe('open');
      expect(IkasMapper.mapOrderStatus('SHIPPED')).toBe('open');
      expect(IkasMapper.mapOrderStatus('DELIVERED')).toBe('closed');
      expect(IkasMapper.mapOrderStatus('CANCELLED')).toBe('cancelled');
    });

    it('maps financial statuses correctly', () => {
      expect(IkasMapper.mapFinancialStatus('PAID')).toBe('paid');
      expect(IkasMapper.mapFinancialStatus('WAITING')).toBe('pending');
      expect(IkasMapper.mapFinancialStatus('REFUNDED')).toBe('refunded');
      expect(IkasMapper.mapFinancialStatus('PARTIALLY_REFUNDED')).toBe('partially_refunded');
    });

    it('maps fulfillment statuses correctly', () => {
      expect(IkasMapper.mapFulfillmentStatus('WAITING_FOR_SHIPMENT')).toBe('unfulfilled');
      expect(IkasMapper.mapFulfillmentStatus('PARTIALLY_SHIPPED')).toBe('partially_fulfilled');
      expect(IkasMapper.mapFulfillmentStatus('SHIPPED')).toBe('in_transit');
      expect(IkasMapper.mapFulfillmentStatus('DELIVERED')).toBe('delivered');
      expect(IkasMapper.mapFulfillmentStatus('CANCELLED')).toBe('cancelled');
    });

    it('maps raw order to EcommerceOrder structure', () => {
      const rawOrder: IkasRawOrder = {
        id: 'ord-123',
        orderNumber: 'IKS-987',
        orderStatus: 'WAITING_FOR_SHIPMENT',
        paymentStatus: 'PAID',
        currency: 'TRY',
        totalPrice: 1500,
        subTotalPrice: 1350,
        totalTax: 150,
        createdAt: '2026-09-15T08:00:00.000Z',
        updatedAt: '2026-09-15T08:30:00.000Z',
        customer: {
          id: 'c-1',
          firstName: 'Mehmet',
          lastName: 'Kaya',
          email: 'mehmet@example.com',
          phone: '+905329998877',
        },
        shippingAddress: {
          firstName: 'Mehmet',
          lastName: 'Kaya',
          address1: 'İnönü Mah. Gül Sok. No: 5',
          city: 'İzmir',
          district: 'Bornova',
          country: 'Türkiye',
          countryCode: 'TR',
        },
        orderLineItems: [
          {
            id: 'li-1',
            productId: 'p-1',
            variantId: 'v-1',
            sku: 'SKU-JEANS-32',
            barcode: '8681234567890',
            name: 'Slim Fit Jean',
            quantity: 1,
            price: 1500,
            finalPrice: 1500,
          },
        ],
      };

      const mapped = IkasMapper.toEcommerceOrder(rawOrder);
      expect(mapped.id).toBe('ord-123');
      expect(mapped.orderNumber).toBe('IKS-987');
      expect(mapped.provider).toBe('IKAS');
      expect(mapped.orderStatus).toBe('open');
      expect(mapped.financialStatus).toBe('paid');
      expect(mapped.fulfillmentStatus).toBe('unfulfilled');
      expect(mapped.totalPrice).toBe(1500);
      expect(mapped.customer?.fullName).toBe('Mehmet Kaya');
      expect(mapped.shippingAddress?.city).toBe('İzmir');
      expect(mapped.items).toHaveLength(1);
      expect(mapped.items[0].sku).toBe('SKU-JEANS-32');
    });

    it('maps raw product to EcommerceProduct structure', () => {
      const rawProduct: IkasRawProduct = {
        id: 'p-1',
        name: 'Deri Ceket',
        description: 'Hakiki kuzu derisi',
        status: 'ACTIVE',
        brand: { name: 'Kroptos Leather' },
        variants: [
          {
            id: 'v-1',
            productId: 'p-1',
            sku: 'JKT-BLK-L',
            barcode: '8689998887771',
            name: 'Siyah / L',
            price: 4500,
            stock: 12,
          },
        ],
      };

      const mapped = IkasMapper.toEcommerceProduct(rawProduct);
      expect(mapped.id).toBe('p-1');
      expect(mapped.provider).toBe('IKAS');
      expect(mapped.title).toBe('Deri Ceket');
      expect(mapped.vendor).toBe('Kroptos Leather');
      expect(mapped.status).toBe('active');
      expect(mapped.variants).toHaveLength(1);
      expect(mapped.variants[0].sku).toBe('JKT-BLK-L');
      expect(mapped.variants[0].inventoryQuantity).toBe(12);
    });
  });

  describe('IkasConnector & IkasMarketplaceAdapter', () => {
    let connector: IkasConnector;
    let adapter: IkasMarketplaceAdapter;

    beforeEach(() => {
      const http = new EcommerceHttpClient();
      const rateLimiter = new EcommerceRateLimiter();
      const credentials = {
        storeUrl: 'https://magaza.myikas.com',
        apiToken: 'mock_token',
      };

      connector = new IkasConnector(credentials, http, rateLimiter);
      adapter = new IkasMarketplaceAdapter(
        credentials,
        new MarketplaceHttpClient(),
        new MarketplaceRateLimiter(),
      );
    });

    it('passes connection test in simulated mode', async () => {
      const res = await connector.testConnection();
      expect(res.success).toBe(true);
      expect(res.message).toContain('İkas');
    });

    it('fetches orders and maps them', async () => {
      const orders = await connector.fetchOrders();
      expect(orders).toBeDefined();
      expect(orders.length).toBeGreaterThan(0);
      expect(orders[0].provider).toBe('IKAS');
    });

    it('updates inventory level successfully', async () => {
      const res = await connector.updateInventory({
        variantId: 'var-1',
        sku: 'SKU-1',
        availableQuantity: 50,
      });
      expect(res.success).toBe(true);
      expect(res.newQuantity).toBe(50);
    });

    it('fulfills order with tracking number', async () => {
      const res = await connector.createFulfillment({
        orderId: 'ikas-order-101',
        carrierName: 'Yurtiçi Kargo',
        trackingNumber: 'YK123456789',
      });
      expect(res.success).toBe(true);
      expect(res.trackingNumber).toBe('YK123456789');
    });

    it('MarketplaceAdapter bridges orders and products seamlessly', async () => {
      const connTest = await adapter.testConnection();
      expect(connTest.success).toBe(true);

      const mpOrders = await adapter.getOrders();
      expect(mpOrders.length).toBeGreaterThan(0);
      expect(mpOrders[0].source).toBe('ikas');

      const mpProducts = await adapter.getProducts();
      expect(mpProducts.length).toBeGreaterThan(0);

      const stockRes = await adapter.updateStock('SKU-1', 25);
      expect(stockRes.success).toBe(true);
    });
  });
});
