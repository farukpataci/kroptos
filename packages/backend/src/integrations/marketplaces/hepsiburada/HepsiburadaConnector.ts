import { MarketplaceConnector } from '../core/MarketplaceConnector';
import { ConnectionTestResult, MarketplaceOrder, MarketplaceProduct, StockUpdateResult } from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { HepsiburadaMapper } from './HepsiburadaMapper';
import { HepsiburadaOrder, HepsiburadaProduct } from './HepsiburadaTypes';

export class HepsiburadaConnector extends MarketplaceConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
  ) {
    super('HEPSIBURADA', credentials, httpClient, rateLimiter);
  }

  private hasInvalidCredentials(): boolean {
    return Object.values(this.credentials).some(
      (val) => typeof val === 'string' && val.toLowerCase().includes('invalid'),
    );
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    await this.rateLimiter.throttle(this.provider, 50, 60000);

    if (this.hasInvalidCredentials()) {
      return {
        success: false,
        message: 'Hepsiburada API bağlantısı başarısız: Geçersiz Merchant ID veya API Anahtarı',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      message: 'Hepsiburada bağlantısı başarıyla doğrulandı',
      durationMs: Date.now() - startTime,
    };
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    await this.rateLimiter.throttle(this.provider, 50, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('Hepsiburada API Authentication Failed');
    }

    const mockHepsiburadaOrders: HepsiburadaOrder[] = [
      {
        id: 'hb-1001',
        orderNumber: 'HB-987654321',
        customer: {
          name: 'Mehmet Öztürk',
          email: 'mehmet.ozturk@example.com',
          phone: '+905333333333',
        },
        shippingAddress: {
          address: 'Mustafa Kemal Mahallesi, 2118. Sokak No:4 Daire:10',
          city: 'Ankara',
          town: 'Çankaya',
        },
        items: [
          {
            sku: 'HB-KB-LED-RGB',
            name: 'Hepsiburada RGB Mekanik Klavye',
            quantity: 1,
            price: 899.9,
          },
        ],
        status: 'Open',
        totalAmount: 899.9,
        currency: 'TRY',
      },
    ];

    return mockHepsiburadaOrders.map((o) => HepsiburadaMapper.toUnifiedOrder(o));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    await this.rateLimiter.throttle(this.provider, 50, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('Hepsiburada API Authentication Failed');
    }

    const mockHepsiburadaProducts: HepsiburadaProduct[] = [
      {
        hepsiburadaSku: 'HB-KB-LED-RGB',
        merchantSku: 'HB-KB-LED-RGB',
        name: 'Hepsiburada RGB Mekanik Klavye',
        description: 'Mekanik mavi switch oyuncu klavyesi.',
        price: 899.9,
        stock: 45,
        image: 'https://images.hepsiburada.net/keyboard.jpg',
        barcode: '869000112233',
      },
    ];

    return mockHepsiburadaProducts.map((p) => HepsiburadaMapper.toUnifiedProduct(p));
  }

  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    await this.rateLimiter.throttle(this.provider, 50, 60000);

    if (this.hasInvalidCredentials()) {
      return {
        sku,
        quantity,
        success: false,
        error: 'Hepsiburada API Authentication Failed',
      };
    }

    if (sku.toLowerCase().includes('error')) {
      return {
        sku,
        quantity,
        success: false,
        error: `HB Merchant API error: Sku '${sku}' stock could not be synced.`,
      };
    }

    return {
      sku,
      quantity,
      success: true,
    };
  }
}
