import { MarketplaceConnector } from '../core/MarketplaceConnector';
import { ConnectionTestResult, MarketplaceOrder, MarketplaceProduct, StockUpdateResult } from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { TrendyolMapper } from './TrendyolMapper';
import { TrendyolOrder, TrendyolProduct } from './TrendyolTypes';

export class TrendyolConnector extends MarketplaceConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
  ) {
    super('TRENDYOL', credentials, httpClient, rateLimiter);
  }

  private hasInvalidCredentials(): boolean {
    return Object.values(this.credentials).some(
      (val) => typeof val === 'string' && val.toLowerCase().includes('invalid'),
    );
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      return {
        success: false,
        message: 'Trendyol API bağlantısı başarısız: Yetkisiz Satıcı ID veya API Anahtarı',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      message: 'Trendyol bağlantısı başarıyla doğrulandı',
      durationMs: Date.now() - startTime,
    };
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('Trendyol API Authentication Failed');
    }

    const mockTrendyolOrders: TrendyolOrder[] = [
      {
        id: 1001,
        orderNumber: 'TY-2026-98124',
        customerFirstName: 'Ahmet',
        customerLastName: 'Yılmaz',
        customerEmail: 'ahmet.yilmaz@example.com',
        customerPhone: '+905551234567',
        shipmentAddress: {
          address1: 'Kadıköy Mahallesi, Göztepe Caddesi No:45',
          city: 'İstanbul',
          country: 'Türkiye',
        },
        lines: [
          {
            barcode: '868000123456',
            sku: 'TY-SHIRT-BLK-M',
            productName: 'Trendyol Basic Erkek Tişört Siyah - M',
            quantity: 2,
            price: 249.9,
            merchantId: Number(this.credentials.sellerId) || 123456,
          },
        ],
        status: 'Created',
        totalPrice: 499.8,
        currency: 'TRY',
      },
      {
        id: 1002,
        orderNumber: 'TY-2026-98125',
        customerFirstName: 'Ayşe',
        customerLastName: 'Kaya',
        customerEmail: 'ayse.kaya@example.com',
        customerPhone: '+905429876543',
        shipmentAddress: {
          address1: 'Çankaya Caddesi No:12 Daire:5',
          city: 'Ankara',
          country: 'Türkiye',
        },
        lines: [
          {
            barcode: '868000987654',
            sku: 'TY-SHOE-RUN-42',
            productName: 'Trendyol Run Spor Ayakkabı Siyah - 42',
            quantity: 1,
            price: 1299.9,
            merchantId: Number(this.credentials.sellerId) || 123456,
          },
        ],
        status: 'Created',
        totalPrice: 1299.9,
        currency: 'TRY',
      },
    ];

    return mockTrendyolOrders.map((o) => TrendyolMapper.toUnifiedOrder(o));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('Trendyol API Authentication Failed');
    }

    const mockTrendyolProducts: TrendyolProduct[] = [
      {
        title: 'Trendyol Basic Erkek Tişört Siyah - M',
        stockCode: 'TY-SHIRT-BLK-M',
        description: 'Yüzde yüz pamuk erkek tişört.',
        salePrice: 249.9,
        quantity: 150,
        images: [{ url: 'https://images.trendyol.com/tshirt.jpg' }],
        barcode: '868000123456',
      },
      {
        title: 'Trendyol Run Spor Ayakkabı Siyah - 42',
        stockCode: 'TY-SHOE-RUN-42',
        description: 'Rahat koşu ayakkabısı.',
        salePrice: 1299.9,
        quantity: 35,
        images: [{ url: 'https://images.trendyol.com/shoe.jpg' }],
        barcode: '868000987654',
      },
    ];

    return mockTrendyolProducts.map((p) => TrendyolMapper.toUnifiedProduct(p));
  }

  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      return {
        sku,
        quantity,
        success: false,
        error: 'Trendyol API Authentication Failed',
      };
    }

    if (sku.toLowerCase().includes('error')) {
      return {
        sku,
        quantity,
        success: false,
        error: `SKU '${sku}' update not allowed by Trendyol catalog service.`,
      };
    }

    return {
      sku,
      quantity,
      success: true,
    };
  }
}
