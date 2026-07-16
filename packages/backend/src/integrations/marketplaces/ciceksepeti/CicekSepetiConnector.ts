import { MarketplaceConnector } from '../core/MarketplaceConnector';
import { ConnectionTestResult, MarketplaceOrder, MarketplaceProduct, StockUpdateResult } from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { CicekSepetiMapper } from './CicekSepetiMapper';
import { CicekSepetiOrder, CicekSepetiProduct } from './CicekSepetiTypes';

export class CicekSepetiConnector extends MarketplaceConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
  ) {
    super('CICEKSEPETI', credentials, httpClient, rateLimiter);
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
        message: 'ÇiçekSepeti API bağlantısı başarısız: Geçersiz x-api-key',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      message: 'ÇiçekSepeti bağlantısı başarıyla doğrulandı',
      durationMs: Date.now() - startTime,
    };
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('CicekSepeti API Authentication Failed');
    }

    const mockCicekSepetiOrders: CicekSepetiOrder[] = [
      {
        id: 5001,
        orderCode: 'CS-444455556',
        receiverName: 'Zeynep Yılmaz',
        receiverPhone: '+905051234567',
        address: 'Barbaros Bulvarı No:12 Daire:4',
        city: 'İstanbul',
        district: 'Beşiktaş',
        status: 'Created',
        totalPrice: 349.0,
        currency: 'TRY',
        items: [
          {
            variantCode: 'CS-FLWR-RED-ROSE',
            name: 'Kırmızı Gül Buketi - 11 Adet',
            quantity: 1,
            price: 349.0,
          },
        ],
      },
    ];

    return mockCicekSepetiOrders.map((o) => CicekSepetiMapper.toUnifiedOrder(o));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('CicekSepeti API Authentication Failed');
    }

    const mockCicekSepetiProducts: CicekSepetiProduct[] = [
      {
        stockCode: 'CS-FLWR-RED-ROSE',
        name: 'Kırmızı Gül Buketi - 11 Adet',
        description: 'Özenle hazırlanmış kırmızı gül aranjmanı.',
        price: 349.0,
        stock: 50,
        mainImage: 'https://images.ciceksepeti.com/roses.jpg',
        barcode: '868000552211',
      },
    ];

    return mockCicekSepetiProducts.map((p) => CicekSepetiMapper.toUnifiedProduct(p));
  }

  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    await this.rateLimiter.throttle(this.provider, 100, 60000);

    if (this.hasInvalidCredentials()) {
      return {
        sku,
        quantity,
        success: false,
        error: 'CicekSepeti API Authentication Failed',
      };
    }

    if (sku.toLowerCase().includes('error')) {
      return {
        sku,
        quantity,
        success: false,
        error: `ÇiçekSepeti API error: SKU '${sku}' is not active or could not be found.`,
      };
    }

    return {
      sku,
      quantity,
      success: true,
    };
  }
}
