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
import { IdeasoftMapper } from './IdeasoftMapper';
import {
  IdeasoftCredentials,
  IdeasoftRawOrder,
  IdeasoftRawProduct,
  IdeasoftTokenResponse,
} from './IdeasoftTypes';

export class IdeasoftConnector extends EcommerceConnector {
  protected override readonly rateLimitPerMinute: number = 60;
  private currentAccessToken: string;

  constructor(
    credentials: Record<string, any>,
    httpClient: EcommerceHttpClient,
    rateLimiter: EcommerceRateLimiter,
    settings: Record<string, unknown> = {},
  ) {
    super('IDEASOFT', credentials, httpClient, rateLimiter, settings);
    this.currentAccessToken = String(credentials.accessToken || '').trim();
  }

  protected override get displayName(): string {
    return 'İdeaSoft';
  }

  /**
   * Normalizes the store domain into an absolute HTTPS URL.
   * e.g. "magazam" -> "https://magazam.myideasoft.com"
   * e.g. "magazam.myideasoft.com" -> "https://magazam.myideasoft.com"
   */
  public getNormalizedStoreUrl(): string {
    const raw = String(
      this.credentials.storeDomain || this.credentials.url || this.setting<string>('general.shopUrl', ''),
    ).trim();

    if (!raw) {
      throw new BadRequestException('İdeaSoft mağaza adresi (storeDomain) belirtilmedi.');
    }

    let domain = raw;
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      try {
        const u = new URL(domain);
        domain = u.hostname;
      } catch {
        // fallback
      }
    }

    // Strip trailing slashes
    domain = domain.replace(/\/+$/, '');

    // If pure store subdomain entered (e.g. "butigim"), append ".myideasoft.com"
    if (!domain.includes('.')) {
      domain = `${domain}.myideasoft.com`;
    }

    return `https://${domain}`;
  }

  /**
   * Automatically refreshes OAuth token using refresh_token if expired or missing.
   */
  private async refreshAccessToken(): Promise<string> {
    const { clientId, clientSecret, refreshToken } = this.credentials as IdeasoftCredentials;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new BadRequestException(
        'İdeaSoft API Access Token geçersiz veya süresi dolmuş. Otomatik yenileme için Client ID, Client Secret ve Refresh Token gereklidir.',
      );
    }

    const storeUrl = this.getNormalizedStoreUrl();
    const tokenUrl = `${storeUrl}/oauth/v2/token`;

    try {
      const resp = await this.httpClient.json<IdeasoftTokenResponse>(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }).toString(),
      });

      if (resp?.access_token) {
        this.currentAccessToken = resp.access_token;
        this.credentials.accessToken = resp.access_token;
        if (resp.refresh_token) {
          this.credentials.refreshToken = resp.refresh_token;
        }
        return resp.access_token;
      }
      throw new Error('İdeaSoft token yenileme yanıtında access_token bulunamadı.');
    } catch (err: any) {
      throw new BadRequestException(`İdeaSoft token yenileme başarısız: ${err?.message || 'Bilinmeyen hata'}`);
    }
  }

  /**
   * Sends an authenticated REST request to IdeaSoft API (/admin-api/...).
   */
  private async sendAdminApi<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    await this.throttle();
    const storeUrl = this.getNormalizedStoreUrl();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const targetUrl = new URL(`${storeUrl}/admin-api${normalizedPath}`);

    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined && v !== null && v !== '') {
          targetUrl.searchParams.set(k, String(v));
        }
      }
    }

    if (!this.currentAccessToken && this.credentials.refreshToken) {
      await this.refreshAccessToken();
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.currentAccessToken}`,
    };

    try {
      return await this.httpClient.json<T>(targetUrl.toString(), {
        method: options.method ?? 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (err: any) {
      // If 401 and refresh credentials available, try refreshing token once
      if (err?.upstreamStatus === 401 && this.credentials.refreshToken) {
        await this.refreshAccessToken();
        headers.Authorization = `Bearer ${this.currentAccessToken}`;
        return await this.httpClient.json<T>(targetUrl.toString(), {
          method: options.method ?? 'GET',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });
      }
      throw err;
    }
  }

  /**
   * Tests store connection and credential validity.
   */
  async testConnection(): Promise<EcommerceConnectionTestResult> {
    const startTime = Date.now();
    try {
      if (!this.currentAccessToken && !this.credentials.refreshToken) {
        return {
          success: false,
          message: 'İdeaSoft API Access Token veya OAuth kimlik bilgileri girilmemiş.',
          details: { durationMs: Date.now() - startTime },
        };
      }

      // Probe products endpoint with limit 1
      await this.sendAdminApi<any[]>('/products', { query: { limit: 1 } });

      return {
        success: true,
        message: 'İdeaSoft mağaza bağlantısı başarıyla doğrulandı.',
        shopDomain: this.getNormalizedStoreUrl(),
        details: { durationMs: Date.now() - startTime },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `İdeaSoft bağlantısı doğrulanamadı: ${err?.message || 'Yetkilendirme veya ağ hatası'}`,
        details: { durationMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Fetches orders from IdeaSoft API.
   */
  async fetchOrders(filter?: EcommerceOrderQueryFilter): Promise<EcommerceOrder[]> {
    const query: Record<string, string | number | boolean | undefined> = {
      limit: filter?.limit ?? 50,
      page: filter?.page ?? 1,
      sort: '-id',
    };

    if (filter?.status) {
      query.status = filter.status;
    }
    if (filter?.cursor) {
      query.since_id = filter.cursor;
    }

    const rawOrders = await this.sendAdminApi<IdeasoftRawOrder[]>('/orders', { query });
    if (!Array.isArray(rawOrders)) return [];

    return rawOrders.map((o) => IdeasoftMapper.toEcommerceOrder(o));
  }

  /**
   * Retrieves single order by ID.
   */
  async getOrder(orderId: string): Promise<EcommerceOrder> {
    const rawOrder = await this.sendAdminApi<IdeasoftRawOrder>(`/orders/${orderId}`);
    if (!rawOrder || !rawOrder.id) {
      throw new BadRequestException(`İdeaSoft siparişi bulunamadı (ID: ${orderId})`);
    }
    return IdeasoftMapper.toEcommerceOrder(rawOrder);
  }

  /**
   * Fetches products catalogue from IdeaSoft.
   */
  async fetchProducts(limit: number = 50, page: number = 1): Promise<EcommerceProduct[]> {
    const rawProducts = await this.sendAdminApi<IdeasoftRawProduct[]>('/products', {
      query: { limit, page, sort: '-id' },
    });

    if (!Array.isArray(rawProducts)) return [];
    return rawProducts.map((p) => IdeasoftMapper.toEcommerceProduct(p));
  }

  /**
   * Updates product stock inventory in IdeaSoft.
   */
  async updateInventory(update: EcommerceInventoryUpdate): Promise<EcommerceInventoryUpdateResult> {
    const qty = Math.max(0, Math.floor(update.availableQuantity));
    try {
      let productId = update.variantId;

      if (!productId && update.sku) {
        const found = await this.sendAdminApi<IdeasoftRawProduct[]>('/products', {
          query: { sku: update.sku, limit: 1 },
        });
        if (Array.isArray(found) && found.length > 0) {
          productId = String(found[0].id);
        }
      }

      if (!productId) {
        return {
          success: false,
          sku: update.sku,
          newQuantity: qty,
          message: `SKU '${update.sku}' olan ürün İdeaSoft mağazasında bulunamadı.`,
        };
      }

      await this.sendAdminApi(`/products/${productId}`, {
        method: 'PUT',
        body: {
          stockAmount: qty,
        },
      });

      return {
        success: true,
        sku: update.sku,
        newQuantity: qty,
      };
    } catch (err: any) {
      return {
        success: false,
        sku: update.sku,
        newQuantity: qty,
        message: err?.message || 'İdeaSoft stok güncelleme başarısız',
      };
    }
  }

  /**
   * Fulfills an order in IdeaSoft by writing tracking number and updating status.
   */
  async createFulfillment(request: EcommerceFulfillmentRequest): Promise<EcommerceFulfillmentResult> {
    try {
      await this.sendAdminApi(`/orders/${request.orderId}`, {
        method: 'PUT',
        body: {
          status: 'shipped',
          cargoTrackingNumber: request.trackingNumber,
          cargoProviderName: request.carrierName,
          cargoTrackingUrl: request.trackingUrl,
        },
      });

      return {
        success: true,
        fulfillmentId: `ful_${request.orderId}`,
        trackingNumber: request.trackingNumber,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'İdeaSoft kargo bilgisi güncellenemedi',
      };
    }
  }

  /**
   * Fetches categories from IdeaSoft.
   */
  async getCategories(): Promise<any[]> {
    const raw = await this.sendAdminApi<any[]>('/categories', { query: { limit: 100 } });
    if (!Array.isArray(raw)) return [];
    return raw.map((c) => ({
      id: String(c.id),
      name: c.name,
      parentId: c.parent ? String(c.parent.id || c.parent) : null,
    }));
  }
}
