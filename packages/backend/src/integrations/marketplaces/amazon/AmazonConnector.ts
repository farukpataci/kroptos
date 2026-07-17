import { MarketplaceConnector } from '../core/MarketplaceConnector';
import { ConnectionTestResult, MarketplaceOrder, MarketplaceProduct, StockUpdateResult } from '../core/MarketplaceTypes';
import { MarketplaceHttpClient } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { AmazonMapper } from './AmazonMapper';
import { AmazonOrder, AmazonProduct } from './AmazonTypes';

export class AmazonConnector extends MarketplaceConnector {
  constructor(
    credentials: Record<string, any>,
    httpClient: MarketplaceHttpClient,
    rateLimiter: MarketplaceRateLimiter,
  ) {
    super('AMAZON', credentials, httpClient, rateLimiter);
  }

  private hasInvalidCredentials(): boolean {
    return Object.values(this.credentials).some(
      (val) => typeof val === 'string' && val.toLowerCase().includes('invalid'),
    );
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    // Amazon SP-API dynamic throttling simulation
    await this.rateLimiter.throttle(this.provider, 20, 60000);

    if (this.hasInvalidCredentials()) {
      return {
        success: false,
        message: 'Amazon SP-API Connection Failed: Invalid AWS Role / SP-API credentials.',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      message: 'Amazon SP-API connection verified successfully.',
      durationMs: Date.now() - startTime,
    };
  }

  async getOrders(): Promise<MarketplaceOrder[]> {
    await this.rateLimiter.throttle(this.provider, 20, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('Amazon SP-API Authentication Failed');
    }

    const mockAmazonOrders: AmazonOrder[] = [
      {
        AmazonOrderId: '408-1234567-1234567',
        PurchaseDate: '2026-06-26T08:00:00Z',
        BuyerInfo: {
          BuyerName: 'John Doe',
          BuyerEmail: 'johndoe@amazon-buyer.com',
          BuyerPhone: '+1-555-0199',
        },
        ShippingAddress: {
          AddressLine1: '1200 12th Ave S',
          City: 'Seattle',
          StateOrRegion: 'WA',
          PostalCode: '98144',
          CountryCode: 'US',
        },
        OrderStatus: 'Unshipped',
        OrderTotal: {
          Amount: '59.98',
          CurrencyCode: 'USD',
        },
        OrderItems: [
          {
            ASIN: 'B08N5WRWNW',
            SellerSKU: 'AMZN-FIRETV-4K',
            Title: 'Amazon Fire TV Stick 4K Max',
            QuantityOrdered: 2,
            ItemPrice: {
              Amount: '29.99',
              CurrencyCode: 'USD',
            },
          },
        ],
      },
    ];

    return mockAmazonOrders.map((o) => AmazonMapper.toUnifiedOrder(o));
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    await this.rateLimiter.throttle(this.provider, 20, 60000);

    if (this.hasInvalidCredentials()) {
      throw new Error('Amazon SP-API Authentication Failed');
    }

    const mockAmazonProducts: AmazonProduct[] = [
      {
        asin: 'B08N5WRWNW',
        sku: 'AMZN-FIRETV-4K',
        attributes: {
          title: [{ value: 'Amazon Fire TV Stick 4K Max' }],
          description: [{ value: 'Amazon Fire TV Stick with Wi-Fi 6 Support.' }],
        },
        price: {
          amount: 29.99,
          currency: 'USD',
        },
        quantity: 80,
        imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/stick.jpg',
      },
    ];

    return mockAmazonProducts.map((p) => AmazonMapper.toUnifiedProduct(p));
  }

  async updateStock(sku: string, quantity: number): Promise<StockUpdateResult> {
    await this.rateLimiter.throttle(this.provider, 20, 60000);

    if (this.hasInvalidCredentials()) {
      return {
        sku,
        quantity,
        success: false,
        error: 'Amazon SP-API Authentication Failed',
      };
    }

    if (sku.toLowerCase().includes('error')) {
      return {
        sku,
        quantity,
        success: false,
        error: `Amazon SP-API error: SKU '${sku}' feed processing rejected.`,
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
