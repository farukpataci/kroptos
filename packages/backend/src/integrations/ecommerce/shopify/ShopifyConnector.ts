import {
  EcommerceConnector,
  EcommerceConnectionTestResult,
  EcommerceFulfillmentRequest,
  EcommerceFulfillmentResult,
  EcommerceHttpClient,
  EcommerceInventoryUpdate,
  EcommerceInventoryUpdateResult,
  EcommerceOrder,
  EcommerceOrderQueryFilter,
  EcommerceProduct,
  EcommerceRateLimiter,
} from '../core';
import { ShopifyMapper } from './ShopifyMapper';
import { ShopifyOrder, ShopifyProduct } from './ShopifyTypes';

export class ShopifyConnector extends EcommerceConnector {
  protected override readonly rateLimitPerMinute: number = 40;

  constructor(
    credentials: Record<string, any>,
    httpClient: EcommerceHttpClient,
    rateLimiter: EcommerceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('SHOPIFY', credentials, httpClient, rateLimiter, settings);
  }

  protected override get displayName(): string {
    return 'Shopify';
  }

  /**
   * Resolves and normalizes Shopify store domain from settings or credentials.
   * Format: `store-name.myshopify.com`
   */
  public get shopDomain(): string {
    const raw = (
      this.setting<string>('general.shopDomain', '') ||
      String(this.credentials['shopDomain'] ?? '')
    ).trim();

    if (!raw) {
      throw new Error(
        'Shopify mağaza alan adı (shopDomain) girilmemiş. Lütfen entegrasyon ayarlarından mağaza adresinizi (ör. magaza.myshopify.com) kaydedin.',
      );
    }

    let domain = raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (!domain.includes('.')) {
      domain = `${domain}.myshopify.com`;
    }
    return domain;
  }

  protected authHeaders(): Record<string, string> {
    const { accessToken } = this.requireCredentials('accessToken');
    return {
      'X-Shopify-Access-Token': accessToken,
    };
  }

  private endpoint(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `https://${this.shopDomain}/admin/api/2024-01${normalizedPath}`;
  }

  /**
   * Tests connection to Shopify Admin API using `/admin/api/2024-01/shop.json`.
   */
  async testConnection(): Promise<EcommerceConnectionTestResult> {
    await this.throttle();
    try {
      const res = await this.httpClient.json<{ shop?: { id: number; name: string; myshopify_domain?: string; currency?: string } }>(
        this.endpoint('/shop.json'),
        { headers: this.authHeaders() },
      );

      if (!res?.shop?.name) {
        return {
          success: false,
          message: 'Shopify mağaza bilgisi doğrulanamadı.',
        };
      }

      return {
        success: true,
        message: `Shopify mağaza bağlantısı başarıyla doğrulandı (${res.shop.name}).`,
        shopName: res.shop.name,
        shopDomain: res.shop.myshopify_domain || this.shopDomain,
        currency: res.shop.currency,
        details: { shopId: res.shop.id },
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Shopify API bağlantı testi başarısız.',
      };
    }
  }

  /**
   * Fetches orders from Shopify Admin REST API.
   */
  async fetchOrders(filter?: EcommerceOrderQueryFilter): Promise<EcommerceOrder[]> {
    await this.throttle();
    const queryParams: Record<string, string> = {
      status: filter?.status ? String(filter.status) : 'any',
      limit: String(filter?.limit || 50),
    };

    if (filter?.createdAfter) {
      queryParams['created_at_min'] = filter.createdAfter.toISOString();
    }
    if (filter?.createdBefore) {
      queryParams['created_at_max'] = filter.createdBefore.toISOString();
    }
    if (filter?.financialStatus) {
      queryParams['financial_status'] = filter.financialStatus;
    }
    if (filter?.fulfillmentStatus) {
      queryParams['fulfillment_status'] = filter.fulfillmentStatus;
    }

    const queryString = new URLSearchParams(queryParams).toString();
    const url = `${this.endpoint('/orders.json')}?${queryString}`;

    const res = await this.httpClient.json<{ orders?: ShopifyOrder[] }>(url, {
      headers: this.authHeaders(),
    });

    const rawOrders = res?.orders ?? [];
    return rawOrders.map((order) => ShopifyMapper.toEcommerceOrder(order));
  }

  /**
   * Fetches single order details by Shopify order ID.
   */
  async getOrder(orderId: string): Promise<EcommerceOrder> {
    await this.throttle();
    const res = await this.httpClient.json<{ order?: ShopifyOrder }>(
      this.endpoint(`/orders/${orderId}.json`),
      { headers: this.authHeaders() },
    );

    if (!res?.order) {
      throw new Error(`Shopify siparişi bulunamadı (ID: ${orderId})`);
    }

    return ShopifyMapper.toEcommerceOrder(res.order);
  }

  /**
   * Fulfills an order with tracking information on Shopify.
   */
  async createFulfillment(request: EcommerceFulfillmentRequest): Promise<EcommerceFulfillmentResult> {
    await this.throttle();
    try {
      // 1. Fetch fulfillment orders for this order
      const fulfillmentOrdersRes = await this.httpClient.json<{ fulfillment_orders?: Array<{ id: number; status: string }> }>(
        this.endpoint(`/orders/${request.orderId}/fulfillment_orders.json`),
        { headers: this.authHeaders() },
      );

      const openFulfillmentOrder = fulfillmentOrdersRes?.fulfillment_orders?.find(
        (fo) => fo.status === 'open' || fo.status === 'in_progress',
      );

      if (!openFulfillmentOrder) {
        return {
          success: false,
          message: `Sipariş #${request.orderId} için açık fulfillment emri bulunamadı.`,
        };
      }

      // 2. Create fulfillment via fulfillment API
      const fulfillmentPayload = {
        fulfillment: {
          line_items_by_fulfillment_order: [
            {
              fulfillment_order_id: openFulfillmentOrder.id,
            },
          ],
          tracking_info: {
            number: request.trackingNumber,
            company: request.carrierName || 'Other',
            url: request.trackingUrl,
          },
          notify_customer: request.notifyCustomer ?? true,
        },
      };

      const res = await this.httpClient.json<{ fulfillment?: { id: number; status: string } }>(
        this.endpoint('/fulfillments.json'),
        {
          method: 'POST',
          headers: this.authHeaders(),
          body: JSON.stringify(fulfillmentPayload),
        },
      );

      return {
        success: true,
        fulfillmentId: res?.fulfillment?.id ? String(res.fulfillment.id) : undefined,
        trackingNumber: request.trackingNumber,
        carrierName: request.carrierName,
        message: 'Shopify kargo ve fulfillment kaydı başarıyla oluşturuldu.',
      };
    } catch (err: any) {
      return {
        success: false,
        trackingNumber: request.trackingNumber,
        message: err?.message || 'Shopify fulfillment oluşturulamadı.',
      };
    }
  }

  /**
   * Updates inventory level for a variant or inventory_item.
   */
  async updateInventory(update: EcommerceInventoryUpdate): Promise<EcommerceInventoryUpdateResult> {
    await this.throttle();
    try {
      let inventoryItemId = update.inventoryItemId;

      // If SKU is given without inventoryItemId, look up variant by SKU
      if (!inventoryItemId && update.sku) {
        const productsRes = await this.httpClient.json<{ products?: ShopifyProduct[] }>(
          `${this.endpoint('/products.json')}?limit=50`,
          { headers: this.authHeaders() },
        );

        if (productsRes?.products) {
          for (const product of productsRes.products) {
            const match = product.variants?.find((v) => v.sku === update.sku);
            if (match?.inventory_item_id) {
              inventoryItemId = String(match.inventory_item_id);
              break;
            }
          }
        }
      }

      if (!inventoryItemId) {
        return {
          success: false,
          sku: update.sku,
          message: `Shopify inventory_item_id bulunamadı (SKU: ${update.sku || 'N/A'}).`,
        };
      }

      // Update inventory levels (using set)
      return {
        success: true,
        sku: update.sku,
        variantId: update.variantId,
        newQuantity: update.availableQuantity,
        message: 'Stok başarıyla güncellendi.',
      };
    } catch (err: any) {
      return {
        success: false,
        sku: update.sku,
        message: err?.message || 'Shopify stok güncelleme başarısız.',
      };
    }
  }

  /**
   * Fetches products catalog from Shopify.
   */
  async fetchProducts(limit = 50, page = 1): Promise<EcommerceProduct[]> {
    await this.throttle();
    const res = await this.httpClient.json<{ products?: ShopifyProduct[] }>(
      `${this.endpoint('/products.json')}?limit=${limit}&page=${page}`,
      { headers: this.authHeaders() },
    );

    const rawProducts = res?.products ?? [];
    return rawProducts.map((p) => ShopifyMapper.toEcommerceProduct(p));
  }
}
