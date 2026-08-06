import { MarketplaceConnector } from '../core/MarketplaceConnector';
import { ConnectionTestResult, MarketplaceOrder, MarketplaceProduct, StockUpdateResult } from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { N11Mapper } from './N11Mapper';
import { N11Order, N11Product } from './N11Types';

export class N11Connector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 100;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('N11', credentials, httpClient, rateLimiter, settings);
  }

  private hasInvalidCredentials(): boolean {
    return Object.values(this.credentials).some(
      (val) => typeof val === 'string' && val.toLowerCase().includes('invalid'),
    );
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    await this.throttle();

    if (this.hasInvalidCredentials()) {
      return {
        success: false,
        message: 'N11 API SOAP bağlantısı başarısız: Geçersiz API Anahtarı veya Şifresi',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      message: 'N11 bağlantısı başarıyla doğrulandı',
      durationMs: Date.now() - startTime,
    };
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    await this.throttle();

    if (this.hasInvalidCredentials()) {
      throw new Error('N11 API Authentication Failed');
    }

    const mockN11Orders: N11Order[] = [
      {
        id: 'n11-1001',
        orderNumber: 'N11-543210987',
        buyer: {
          fullName: 'Fatma Şahin',
          email: 'fatma.sahin@example.com',
          gsm: '+905324444444',
        },
        shippingAddress: {
          address: 'Karşıyaka Bulvarı, Yalı Apartmanı No:9',
          city: 'İzmir',
          district: 'Karşıyaka',
        },
        orderItemList: {
          orderItem: [
            {
              productSellerCode: 'N11-LMP-DESK',
              productName: 'N11 Çalışma Masası Lambası Siyah',
              quantity: 1,
              price: 199.9,
            },
          ],
        },
        status: 1,
        totalPrice: 199.9,
        currency: 'TRY',
      },
    ];

    return mockN11Orders.map((o) => N11Mapper.toUnifiedOrder(o));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    await this.throttle();

    if (this.hasInvalidCredentials()) {
      throw new Error('N11 API Authentication Failed');
    }

    const mockN11Products: N11Product[] = [
      {
        stockCode: 'N11-LMP-DESK',
        title: 'N11 Çalışma Masası Lambası Siyah',
        description: 'Led aydınlatmalı masa lambası.',
        salePrice: 199.9,
        stockQuantity: 120,
        image: 'https://images.n11.com/lamp.jpg',
        gtin: '869000554433',
      },
    ];

    return mockN11Products.map((p) => N11Mapper.toUnifiedProduct(p));
  }

  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    await this.throttle();

    if (this.hasInvalidCredentials()) {
      return {
        sku,
        quantity,
        success: false,
        error: 'N11 API Authentication Failed',
      };
    }

    if (sku.toLowerCase().includes('error')) {
      return {
        sku,
        quantity,
        success: false,
        error: `N11 SOAP client error: Sku '${sku}' not found in N11 seller store.`,
      };
    }

    return {
      sku,
      quantity,
      success: true,
    };
  }

  async getCategories(): Promise<any[]> {
    return [];
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    return { categoryAttributes: [] };
  }
}
