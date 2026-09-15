import { EcommerceConnector } from '../core/EcommerceConnector';
import { EcommerceHttpClient } from '../core/EcommerceHttpClient';
import { EcommerceRateLimiter } from '../core/EcommerceRateLimiter';
import {
  EcommerceConnectionTestResult,
  EcommerceFulfillmentRequest,
  EcommerceFulfillmentResult,
  EcommerceInventoryUpdate,
  EcommerceInventoryUpdateResult,
  EcommerceOrder,
  EcommerceOrderQueryFilter,
  EcommerceProduct,
} from '../core/EcommerceTypes';
import { IkasClient } from './IkasClient';
import { IkasCredentials } from './IkasTypes';
import { IkasMapper } from './IkasMapper';

export class IkasConnector extends EcommerceConnector {
  protected override readonly rateLimitPerMinute: number = 120;
  private readonly client: IkasClient;

  constructor(
    credentials: Record<string, any>,
    httpClient: EcommerceHttpClient,
    rateLimiter: EcommerceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('IKAS', credentials, httpClient, rateLimiter, settings);

    const creds: IkasCredentials = {
      storeUrl: String(credentials.storeUrl || credentials.storeDomain || credentials.url || ''),
      storeDomain: String(credentials.storeDomain || credentials.storeUrl || credentials.domain || ''),
      apiToken: String(credentials.apiToken || credentials.accessToken || credentials.apiKey || ''),
      clientId: credentials.clientId ? String(credentials.clientId) : undefined,
      clientSecret: credentials.clientSecret ? String(credentials.clientSecret) : undefined,
    };

    this.client = new IkasClient(creds, httpClient);
  }

  public override get displayName(): string {
    return 'İkas';
  }

  public getIkasClient(): IkasClient {
    return this.client;
  }

  /**
   * Tests connection and authentication against İkas.
   */
  public async testConnection(): Promise<EcommerceConnectionTestResult> {
    const startTime = Date.now();
    await this.throttle();

    const res = await this.client.testConnection();
    return {
      success: res.success,
      message: res.message,
      shopDomain: this.client.getNormalizedStoreUrl(),
      details: { ...res.details, durationMs: Date.now() - startTime },
    };
  }

  /**
   * Fetches orders from İkas.
   */
  public async fetchOrders(filter?: EcommerceOrderQueryFilter): Promise<EcommerceOrder[]> {
    await this.throttle();

    const limit = filter?.limit || 50;
    const page = filter?.page || 1;

    const rawOrders = await this.client.getOrders({ limit, page });
    return rawOrders.map((raw) => IkasMapper.toEcommerceOrder(raw));
  }

  /**
   * Fetches single order details by ID.
   */
  public async getOrder(orderId: string): Promise<EcommerceOrder> {
    await this.throttle();

    const raw = await this.client.getOrder(orderId);
    return IkasMapper.toEcommerceOrder(raw);
  }

  /**
   * Fulfills an order with carrier tracking information.
   */
  public async createFulfillment(
    request: EcommerceFulfillmentRequest,
  ): Promise<EcommerceFulfillmentResult> {
    await this.throttle();

    const res = await this.client.createFulfillment({
      orderId: request.orderId,
      cargoCompany: request.carrierName || request.carrierCode || 'Standart Kargo',
      trackingNumber: request.trackingNumber,
      trackingUrl: request.trackingUrl,
      lineItemIds: request.lineItems?.map((i) => i.id),
    });

    return {
      success: res.success,
      trackingNumber: request.trackingNumber,
      carrierName: request.carrierName,
      message: res.message || (res.success ? 'Sipariş kargo bilgisi İkas üzerine aktarıldı.' : 'Kargo aktarımı başarısız.'),
    };
  }

  /**
   * Updates inventory level in İkas for a product variant.
   */
  public async updateInventory(
    update: EcommerceInventoryUpdate,
  ): Promise<EcommerceInventoryUpdateResult> {
    await this.throttle();

    const variantId = update.variantId || update.inventoryItemId || update.sku;
    if (!variantId) {
      return {
        success: false,
        sku: update.sku,
        message: 'İkas stok güncellemesi için variantId veya sku gereklidir.',
      };
    }

    const success = await this.client.updateStock({
      variantId,
      sku: update.sku,
      stock: update.availableQuantity,
    });

    return {
      success,
      variantId,
      sku: update.sku,
      newQuantity: update.availableQuantity,
      message: success ? 'Stok güncellendi.' : 'İkas stok güncellemesi başarısız oldu.',
    };
  }

  /**
   * Fetches products catalogue from İkas.
   */
  public async fetchProducts(limit?: number, page?: number): Promise<EcommerceProduct[]> {
    await this.throttle();

    const rawProducts = await this.client.getProducts({ limit, page });
    return rawProducts.map((raw) => IkasMapper.toEcommerceProduct(raw));
  }
}
