import { BadRequestException } from '@nestjs/common';
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
import { OpencartClient } from './OpencartClient';
import { OpencartCredentials } from './OpencartTypes';
import { OpencartMapper } from './OpencartMapper';

export class OpencartConnector extends EcommerceConnector {
  protected override readonly rateLimitPerMinute: number = 60;
  private readonly client: OpencartClient;

  constructor(
    credentials: Record<string, any>,
    httpClient: EcommerceHttpClient,
    rateLimiter: EcommerceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('OPENCART', credentials, httpClient, rateLimiter, settings);

    const creds: OpencartCredentials = {
      url: String(credentials.url || credentials.storeUrl || credentials.storeDomain || ''),
      username: String(credentials.username || credentials.user || ''),
      apiKey: String(credentials.apiKey || credentials.key || credentials.password || ''),
    };

    this.client = new OpencartClient(creds, httpClient);
  }

  public override get displayName(): string {
    return 'OpenCart';
  }

  public getOpencartClient(): OpencartClient {
    return this.client;
  }

  /**
   * Tests connection by executing an API login request.
   */
  public async testConnection(): Promise<EcommerceConnectionTestResult> {
    const startTime = Date.now();
    try {
      await this.throttle();
      await this.client.login();

      return {
        success: true,
        message: 'OpenCart bağlantısı ve API oturum doğrulaması başarılı.',
        shopDomain: this.client.getNormalizedStoreUrl(),
        details: { durationMs: Date.now() - startTime },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'OpenCart mağaza API bağlantısı kurulamadı.',
        shopDomain: this.client.getNormalizedStoreUrl(),
        details: { durationMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Fetches orders from OpenCart with pagination and status filters.
   */
  public async fetchOrders(filter?: EcommerceOrderQueryFilter): Promise<EcommerceOrder[]> {
    await this.throttle();

    const limit = filter?.limit || 50;
    const page = filter?.page || 1;

    const response = await this.client.getOrders({
      page,
      limit,
    });

    const rawOrders = response.orders || [];

    const orders: EcommerceOrder[] = [];
    for (const raw of rawOrders) {
      let fullOrder = raw;
      if (!raw.products || raw.products.length === 0) {
        try {
          const detailRes = await this.client.getOrder(raw.order_id);
          if (detailRes && detailRes.order) {
            fullOrder = detailRes.order;
          }
        } catch {
          // Fallback to basic order if detail fetch fails
        }
      }
      orders.push(OpencartMapper.toUnifiedOrder(fullOrder));
    }

    return orders;
  }

  /**
   * Retrieves single order by OpenCart order ID.
   */
  public async getOrder(orderId: string): Promise<EcommerceOrder> {
    await this.throttle();

    const res = await this.client.getOrder(orderId);
    if (!res || !res.order) {
      throw new BadRequestException(`OpenCart siparişi bulunamadı: #${orderId}`);
    }

    return OpencartMapper.toUnifiedOrder(res.order);
  }

  /**
   * Updates fulfillment status in OpenCart with tracking number and carrier name.
   */
  public async createFulfillment(
    request: EcommerceFulfillmentRequest,
  ): Promise<EcommerceFulfillmentResult> {
    await this.throttle();

    // OpenCart Order Status ID 3 = Shipped (Kargoya Verildi)
    const statusId = 3;

    let comment = 'Kargoya verildi.';
    if (request.carrierName && request.trackingNumber) {
      comment = `Kargo Firması: ${request.carrierName} - Takip No: ${request.trackingNumber}`;
    } else if (request.trackingNumber) {
      comment = `Takip No: ${request.trackingNumber}`;
    }

    if (request.trackingUrl) {
      comment += `\nKargo Takip Linki: ${request.trackingUrl}`;
    }

    try {
      await this.client.addOrderHistory(request.orderId, {
        order_status_id: statusId,
        comment,
        notify: request.notifyCustomer !== false,
      });

      return {
        success: true,
        fulfillmentId: `${request.orderId}_fulfillment_${Date.now()}`,
        trackingNumber: request.trackingNumber,
        carrierName: request.carrierName,
      };
    } catch (err: any) {
      return {
        success: false,
        trackingNumber: request.trackingNumber,
        carrierName: request.carrierName,
      };
    }
  }

  /**
   * Updates stock quantity for a product in OpenCart.
   */
  public async updateInventory(
    update: EcommerceInventoryUpdate,
  ): Promise<EcommerceInventoryUpdateResult> {
    await this.throttle();

    const targetId = update.productId || update.sku || update.variantId || '';
    try {
      await this.client.updateStock(targetId, update.availableQuantity);

      return {
        success: true,
        sku: update.sku,
        newQuantity: update.availableQuantity,
      };
    } catch (err: any) {
      return {
        success: false,
        sku: update.sku,
        newQuantity: update.availableQuantity,
        message: err.message || 'Stok güncellenemedi',
      };
    }
  }

  /**
   * Fetches products from OpenCart with pagination.
   */
  public async fetchProducts(limit = 50, page = 1): Promise<EcommerceProduct[]> {
    await this.throttle();

    const res = await this.client.getProducts({
      page,
      limit,
    });

    const rawProducts = res.products || [];
    const baseUrl = this.client.getNormalizedStoreUrl();

    return rawProducts.map((p) => OpencartMapper.toUnifiedProduct(p, baseUrl));
  }

  /**
   * Fetches product categories from OpenCart.
   */
  public async getCategories(): Promise<any[]> {
    await this.throttle();

    const list = await this.client.getCategories();
    return list.map((c) => ({
      categoryId: String(c.category_id),
      name: c.name,
      parentId: c.parent_id && String(c.parent_id) !== '0' ? String(c.parent_id) : undefined,
    }));
  }
}
