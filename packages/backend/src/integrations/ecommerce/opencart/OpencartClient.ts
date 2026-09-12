import { BadRequestException } from '@nestjs/common';
import { MarketplaceHttpClient } from '../../marketplaces/core/MarketplaceHttpClient';
import { EcommerceHttpClient } from '../core/EcommerceHttpClient';
import {
  OpencartCredentials,
  OpencartLoginResponse,
  OpencartOrdersResponse,
  OpencartOrderInfoResponse,
  OpencartProductsResponse,
  OpencartRawCategory,
} from './OpencartTypes';

type AnyHttpClient = MarketplaceHttpClient | EcommerceHttpClient;

export class OpencartClient {
  private apiToken: string | null = null;
  private sessionCookie: string | null = null;

  constructor(
    private readonly credentials: OpencartCredentials,
    private readonly httpClient: AnyHttpClient,
  ) {}

  public getNormalizedStoreUrl(): string {
    const raw = String(this.credentials.url || '').trim();
    if (!raw) {
      throw new BadRequestException('OpenCart mağaza adresi (url) belirtilmedi.');
    }

    let url = raw;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    return url.replace(/\/+$/, '');
  }

  public getStoreHost(): string {
    const base = this.getNormalizedStoreUrl();
    return base.replace(/^https?:\/\//, '').split('/')[0];
  }

  private async executeHttp(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<any> {
    const client = this.httpClient as any;

    if (typeof client.request === 'function') {
      const resp = await client.request(url, {
        method,
        headers,
        body,
      });

      if (typeof resp === 'string') {
        try {
          return JSON.parse(resp);
        } catch {
          return resp;
        }
      }
      return resp;
    }

    if (method === 'POST') {
      const res = await client.post(url, body, { headers });
      return res.data ?? res;
    }

    if (method === 'PUT') {
      const res = await client.put(url, body, { headers });
      return res.data ?? res;
    }

    const res = await client.get(url, { headers });
    return res.data ?? res;
  }

  /**
   * Performs authentication against OpenCart API (route=api/login).
   */
  public async login(): Promise<string> {
    const baseUrl = this.getNormalizedStoreUrl();
    const loginUrl = `${baseUrl}/index.php?route=api/login`;

    const username = String(this.credentials.username || '').trim();
    const apiKey = String(this.credentials.apiKey || '').trim();

    if (!username || !apiKey) {
      throw new BadRequestException('OpenCart API kullanıcı adı ve API anahtarı zorunludur.');
    }

    const bodyData = new URLSearchParams({
      username,
      key: apiKey,
    }).toString();

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };

    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }

    const data: OpencartLoginResponse = await this.executeHttp(
      loginUrl,
      'POST',
      headers,
      bodyData,
    );

    const token = data?.api_token || data?.token;

    if (!token && !data?.success) {
      const errMsg =
        typeof data?.error === 'object'
          ? Object.values(data.error).join(', ')
          : data?.error || 'OpenCart API giriş başarısız oldu.';
      throw new BadRequestException(`OpenCart Kimlik Doğrulama Hatası: ${errMsg}`);
    }

    this.apiToken = token || 'session_authenticated';
    return this.apiToken;
  }

  /**
   * Centralized HTTP request with automatic token injection and expired session retry.
   */
  public async request<T = any>(
    pathOrRoute: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT';
      params?: Record<string, any>;
      body?: any;
    } = {},
  ): Promise<T> {
    return this.withTokenRetry(async () => {
      if (!this.apiToken) {
        await this.login();
      }

      const baseUrl = this.getNormalizedStoreUrl();
      const method = options.method || 'GET';
      const queryParams = new URLSearchParams();

      let url: string;
      if (pathOrRoute.startsWith('http://') || pathOrRoute.startsWith('https://')) {
        url = pathOrRoute;
      } else if (pathOrRoute.includes('route=')) {
        url = `${baseUrl}/index.php?${pathOrRoute}`;
      } else if (pathOrRoute.startsWith('/')) {
        url = `${baseUrl}${pathOrRoute}`;
      } else {
        url = `${baseUrl}/index.php?route=${pathOrRoute}`;
      }

      if (options.params) {
        for (const [k, v] of Object.entries(options.params)) {
          if (v !== undefined && v !== null) {
            queryParams.append(k, String(v));
          }
        }
      }

      if (this.apiToken && this.apiToken !== 'session_authenticated') {
        queryParams.append('api_token', this.apiToken);
        queryParams.append('token', this.apiToken);
      }

      const fullUrl = queryParams.toString()
        ? `${url}${url.includes('?') ? '&' : '?'}${queryParams.toString()}`
        : url;

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      if (this.sessionCookie) {
        headers['Cookie'] = this.sessionCookie;
      }

      let bodyPayload = options.body;
      if (bodyPayload && typeof bodyPayload === 'object' && !(bodyPayload instanceof URLSearchParams)) {
        headers['Content-Type'] = 'application/json';
        bodyPayload = JSON.stringify(bodyPayload);
      } else if (bodyPayload instanceof URLSearchParams) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        bodyPayload = bodyPayload.toString();
      }

      const data = await this.executeHttp(fullUrl, method, headers, bodyPayload);

      // Detect if OpenCart rejected the token / session
      if (
        data &&
        typeof data === 'object' &&
        data.error &&
        (typeof data.error === 'string'
          ? data.error.toLowerCase().includes('token') || data.error.toLowerCase().includes('geçersiz')
          : typeof data.error.warning === 'string' &&
            (data.error.warning.toLowerCase().includes('token') ||
              data.error.warning.toLowerCase().includes('yetki') ||
              data.error.warning.toLowerCase().includes('geçersiz')))
      ) {
        throw new Error('OPENCART_SESSION_EXPIRED');
      }

      return data;
    });
  }

  private async withTokenRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.message === 'OPENCART_SESSION_EXPIRED') {
        this.apiToken = null;
        await this.login();
        return await fn();
      }
      throw err;
    }
  }

  public async getOrders(params?: {
    page?: number;
    limit?: number;
    filter_order_status_id?: string | number;
  }): Promise<OpencartOrdersResponse> {
    return this.request<OpencartOrdersResponse>('api/order/orders', {
      method: 'GET',
      params,
    });
  }

  public async getOrder(orderId: string | number): Promise<OpencartOrderInfoResponse> {
    return this.request<OpencartOrderInfoResponse>('api/order/info', {
      method: 'GET',
      params: { order_id: orderId },
    });
  }

  public async addOrderHistory(
    orderId: string | number,
    data: {
      order_status_id: number | string;
      comment?: string;
      notify?: number | boolean;
    },
  ): Promise<any> {
    const body = new URLSearchParams({
      order_status_id: String(data.order_status_id),
      comment: data.comment || '',
      notify: data.notify ? '1' : '0',
    });

    return this.request('api/order/history', {
      method: 'POST',
      params: { order_id: orderId },
      body,
    });
  }

  public async updateStock(productId: string | number, quantity: number): Promise<any> {
    const body = new URLSearchParams({
      product_id: String(productId),
      quantity: String(quantity),
    });

    return this.request('api/product/editStock', {
      method: 'POST',
      body,
    });
  }

  public async getProducts(params?: {
    page?: number;
    limit?: number;
    filter_status?: number;
  }): Promise<OpencartProductsResponse> {
    return this.request<OpencartProductsResponse>('api/product/products', {
      method: 'GET',
      params,
    });
  }

  public async getCategories(): Promise<OpencartRawCategory[]> {
    const res = await this.request<any>('api/category/categories', {
      method: 'GET',
    });
    return Array.isArray(res) ? res : res?.categories || [];
  }
}
