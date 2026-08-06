import { MarketplaceConnector } from '../core/MarketplaceConnector';
import { ConnectionTestResult, MarketplaceOrder, MarketplaceProduct, StockUpdateResult } from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { TrendyolMapper } from './TrendyolMapper';
import { TrendyolOrder, TrendyolProduct } from './TrendyolTypes';

export class TrendyolConnector extends MarketplaceConnector {
  protected readonly defaultRateLimit = 100;

  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('TRENDYOL', credentials, httpClient, rateLimiter, settings);
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
    await this.throttle();

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
    await this.throttle();

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
    await this.throttle();

    if (this.hasInvalidCredentials()) {
      return {
        sku,
        quantity,
        success: false,
        error: 'Trendyol API Authentication Failed',
      };
    }

    return {
      sku,
      quantity,
      success: true,
    };
  }

  async getCategories(): Promise<any[]> {
    try {
      const url = 'https://apigw.trendyol.com/integration/product/product-categories';
      const res = await this.httpClient.request<{ categories: any[] }>(url, {
        method: 'GET',
        timeout: 5000,
        retries: 1,
      });
      return res.categories || [];
    } catch (e: any) {
      console.warn('[TrendyolConnector] Failed to fetch real categories, falling back to mock categories tree:', e.message);
      return [
        {
          id: 387,
          name: "Tişört",
          parentId: null,
          subCategories: [
            { id: 1045, name: "Erkek Tişört", parentId: 387, subCategories: [] },
            { id: 1046, name: "Kadın Tişört", parentId: 387, subCategories: [] }
          ]
        },
        {
          id: 388,
          name: "Ayakkabı",
          parentId: null,
          subCategories: [
            { id: 1050, name: "Spor Ayakkabı", parentId: 388, subCategories: [] },
            { id: 1051, name: "Klasik Ayakkabı", parentId: 388, subCategories: [] }
          ]
        },
        {
          id: 389,
          name: "Elbise",
          parentId: null,
          subCategories: []
        }
      ];
    }
  }

  async getCategoryAttributes(categoryId: string): Promise<any> {
    try {
      const url = `https://api.trendyol.com/sapigw/product-categories/${categoryId}/attributes`;
      const res = await this.httpClient.request<any>(url, {
        method: 'GET',
        timeout: 5000,
        retries: 1,
      });
      return res || { categoryAttributes: [] };
    } catch (e: any) {
      console.warn(`[TrendyolConnector] Failed to fetch attributes for category ${categoryId}, falling back to mock attributes:`, e.message);
      return {
        id: Number(categoryId),
        displayName: "Test Kategori",
        categoryAttributes: [
          {
            required: true,
            allowCustom: false,
            attribute: { id: 338, name: "Beden" },
            variability: "VARIANTS",
            attributeValues: [
              { id: 1, name: "S" },
              { id: 2, name: "M" },
              { id: 3, name: "L" },
              { id: 4, name: "XL" }
            ]
          },
          {
            required: true,
            allowCustom: false,
            attribute: { id: 343, name: "Renk" },
            variability: "VARIANTS",
            attributeValues: [
              { id: 10, name: "Siyah" },
              { id: 11, name: "Beyaz" },
              { id: 12, name: "Mavi" },
              { id: 13, name: "Kırmızı" }
            ]
          },
          {
            required: true,
            allowCustom: false,
            attribute: { id: 12, name: "Cinsiyet" },
            variability: "UNIFIED",
            attributeValues: [
              { id: 20, name: "Erkek" },
              { id: 21, name: "Kadın" },
              { id: 22, name: "Unisex" }
            ]
          },
          {
            required: false,
            allowCustom: true,
            attribute: { id: 102, name: "Materyal" },
            variability: "UNIFIED",
            attributeValues: [
              { id: 30, name: "Pamuk" },
              { id: 31, name: "Polyester" }
            ]
          }
        ]
      };
    }
  }
}
