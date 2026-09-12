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
import { TsoftClient } from './TsoftClient';
import { TsoftMapper } from './TsoftMapper';
import { TsoftRawOrder, TsoftRawProduct } from './TsoftTypes';

export class TsoftConnector extends EcommerceConnector {
  protected override readonly rateLimitPerMinute: number = 60;
  private readonly client: TsoftClient;

  constructor(
    credentials: Record<string, any>,
    httpClient: EcommerceHttpClient,
    rateLimiter: EcommerceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('TSOFT', credentials, httpClient, rateLimiter, settings);
    this.client = new TsoftClient(
      {
        storeDomain: String(credentials.storeDomain || credentials.domain || credentials.url || ''),
        username: String(credentials.username || credentials.user || ''),
        password: String(credentials.password || credentials.pass || ''),
      },
      httpClient,
    );
  }

  protected override get displayName(): string {
    return 'T-Soft';
  }

  /**
   * Tests connection and credentials validity by logging in and querying sample data.
   */
  async testConnection(): Promise<EcommerceConnectionTestResult> {
    const start = Date.now();
    try {
      await this.throttle();
      const token = await this.client.login();

      // Verify token with a quick product count probe
      const res = await this.client.post('product/getProducts', { start: 0, limit: 1 });

      const count = Array.isArray(res?.data) ? res.data.length : 0;

      return {
        success: true,
        message: `T-Soft bağlantısı başarılı. Oturum belirteci alındı.`,
        shopDomain: this.client.getNormalizedStoreUrl(),
        details: { durationMs: Date.now() - start, hasSampleData: count > 0 },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `T-Soft bağlantı hatası: ${err?.message || 'Bilinmeyen hata'}`,
        shopDomain: this.client.getNormalizedStoreUrl(),
        details: { durationMs: Date.now() - start },
      };
    }
  }

  /**
   * Fetches orders from T-Soft REST API v1.
   */
  async fetchOrders(filter?: EcommerceOrderQueryFilter): Promise<EcommerceOrder[]> {
    await this.throttle();

    const limit = filter?.limit || 50;
    const page = filter?.page || 1;
    const start = (page - 1) * limit;

    const params: Record<string, any> = {
      start,
      limit,
    };

    if (filter?.status) {
      params.status = filter.status;
    }
    if (filter?.createdAfter) {
      params.startDate = filter.createdAfter.toISOString().split('T')[0];
    }
    if (filter?.createdBefore) {
      params.endDate = filter.createdBefore.toISOString().split('T')[0];
    }

    const res = await this.client.post('order/getOrders', params);

    const rawList: TsoftRawOrder[] = Array.isArray(res?.data) ? res.data : [];
    return rawList.map((o) => TsoftMapper.toUnifiedOrder(o));
  }

  /**
   * Fetches a single order by ID from T-Soft.
   */
  async getOrder(orderId: string): Promise<EcommerceOrder> {
    await this.throttle();

    const res = await this.client.post('order/getOrder', { OrderId: orderId });

    const rawOrder: TsoftRawOrder = Array.isArray(res?.data) ? res.data[0] : res?.data;

    if (!rawOrder) {
      // Fallback to getOrders query
      const listRes = await this.client.post('order/getOrders', { orderId });
      const found = Array.isArray(listRes?.data) ? listRes.data[0] : null;
      if (!found) {
        throw new BadRequestException(`T-Soft siparişi bulunamadı: ${orderId}`);
      }
      return TsoftMapper.toUnifiedOrder(found);
    }

    return TsoftMapper.toUnifiedOrder(rawOrder);
  }

  /**
   * Updates fulfillment with tracking information.
   */
  async createFulfillment(request: EcommerceFulfillmentRequest): Promise<EcommerceFulfillmentResult> {
    await this.throttle();

    const carrier = request.carrierName || request.carrierCode || '';

    try {
      const params = {
        OrderId: request.orderId,
        CargoTrackingCode: request.trackingNumber,
        CargoTrackingUrl: request.trackingUrl || '',
        CargoCompany: carrier,
        OrderStatus: 'Kargoya Verildi',
      };

      await this.client.post('order/updateOrder', params);

      return {
        success: true,
        fulfillmentId: `${request.orderId}-fulfillment`,
        trackingNumber: request.trackingNumber,
        carrierName: carrier,
      };
    } catch (err: any) {
      throw new BadRequestException(`T-Soft kargo takip güncelleme hatası: ${err?.message || 'Bilinmeyen hata'}`);
    }
  }

  /**
   * Updates stock inventory for a SKU in T-Soft.
   */
  async updateInventory(update: EcommerceInventoryUpdate): Promise<EcommerceInventoryUpdateResult> {
    await this.throttle();

    try {
      const params = {
        ProductCode: update.sku,
        Stock: update.availableQuantity,
      };

      const res = await this.client.post('product/updateProductStock', params);

      if (res?.success === false) {
        return {
          sku: update.sku,
          success: false,
          message: Array.isArray(res?.message) ? res.message.join(', ') : res?.message || 'Stok güncellenemedi',
        };
      }

      return {
        sku: update.sku,
        newQuantity: update.availableQuantity,
        success: true,
      };
    } catch (err: any) {
      return {
        sku: update.sku,
        success: false,
        message: err?.message || 'Stok güncellenemedi',
      };
    }
  }

  /**
   * Fetches product catalogue from T-Soft.
   */
  async fetchProducts(limit: number = 50, page: number = 1): Promise<EcommerceProduct[]> {
    await this.throttle();

    const start = (page - 1) * limit;
    const res = await this.client.post('product/getProducts', { start, limit });

    const rawList: TsoftRawProduct[] = Array.isArray(res?.data) ? res.data : [];
    return rawList.map((p) => TsoftMapper.toUnifiedProduct(p));
  }

  /**
   * Fetches categories from T-Soft.
   */
  async getCategories(): Promise<any[]> {
    await this.throttle();

    const res = await this.client.post('category/getCategories');
    const list = Array.isArray(res?.data) ? res.data : [];

    return list.map((c: any) => ({
      id: String(c.CategoryId || c.id || ''),
      name: c.CategoryName || c.name || '',
      parentId: c.ParentId ? String(c.ParentId) : undefined,
    }));
  }
}
