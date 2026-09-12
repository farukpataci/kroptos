import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { EcommerceHttpClient, EcommerceHttpError } from '../core/EcommerceHttpClient';
import { TsoftAuthResponse, TsoftCredentials } from './TsoftTypes';

export class TsoftClient {
  private activeToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private readonly credentials: TsoftCredentials,
    private readonly httpClient: EcommerceHttpClient,
  ) {}

  /**
   * Normalizes the base store domain into HTTPS URL (e.g. "https://magaza.com").
   */
  public getNormalizedStoreUrl(): string {
    const raw = String(this.credentials.storeDomain || '').trim();
    if (!raw) {
      throw new BadRequestException('T-Soft mağaza adresi (storeDomain) belirtilmedi.');
    }

    let url = raw;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    url = url.replace(/\/+$/, '');

    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return url;
    }
  }

  private get baseRestUrl(): string {
    return `${this.getNormalizedStoreUrl()}/rest1`;
  }

  /**
   * Logs in to T-Soft REST API v1 and acquires a session token.
   */
  public async login(): Promise<string> {
    const username = encodeURIComponent(String(this.credentials.username || '').trim());
    const password = String(this.credentials.password || '').trim();

    if (!username || !password) {
      throw new BadRequestException('T-Soft kullanıcı adı ve şifresi gereklidir.');
    }

    const loginUrl = `${this.baseRestUrl}/auth/login/${username}`;
    const formParams = new URLSearchParams();
    formParams.set('pass', password);

    try {
      const responseText = await this.httpClient.request(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
        timeoutMs: 15000,
      });

      let json: TsoftAuthResponse;
      try {
        json = JSON.parse(responseText);
      } catch {
        throw new BadRequestException(`T-Soft giriş yanıtı JSON değil: ${responseText.slice(0, 200)}`);
      }

      if (!json.success || !json.data || json.data.length === 0 || !json.data[0].token) {
        const msg = Array.isArray(json.message)
          ? json.message.join(', ')
          : json.message || 'Geçersiz kullanıcı bilgileri veya yetki hatası.';
        throw new BadRequestException(`T-Soft giriş başarısız: ${msg}`);
      }

      this.activeToken = json.data[0].token;
      // Tokens are typically valid for 24-48 hours. Set local expiry to 12 hours from now.
      this.tokenExpiresAt = Date.now() + 12 * 60 * 60 * 1000;

      return this.activeToken;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`T-Soft oturum açma hatası: ${err?.message || 'Bilinmeyen hata'}`);
    }
  }

  /**
   * Returns valid token, requesting a new one if expired or not yet fetched.
   */
  public async getToken(): Promise<string> {
    if (this.activeToken && Date.now() < this.tokenExpiresAt) {
      return this.activeToken;
    }
    return this.login();
  }

  /**
   * Executes an authenticated POST request against a T-Soft REST endpoint with automatic token refresh.
   */
  public async post<T = any>(
    endpoint: string,
    params: Record<string, any> = {},
    retryOnAuthFailure: boolean = true,
  ): Promise<T> {
    const token = await this.getToken();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${this.baseRestUrl}/${cleanEndpoint}`;

    const formParams = new URLSearchParams();
    formParams.set('token', token);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          formParams.set(key, JSON.stringify(value));
        } else {
          formParams.set(key, String(value));
        }
      }
    }

    try {
      const responseText = await this.httpClient.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
        timeoutMs: 25000,
      });

      let json: any;
      try {
        json = JSON.parse(responseText);
      } catch {
        throw new BadRequestException(`T-Soft yanıtı JSON formatında değil (${endpoint})`);
      }

      // Check for token invalidation / expiration message in body
      if (json.success === false) {
        const msg = JSON.stringify(json.message || '');
        if (
          retryOnAuthFailure &&
          (msg.toLowerCase().includes('token') ||
            msg.toLowerCase().includes('auth') ||
            msg.toLowerCase().includes('oturum') ||
            msg.toLowerCase().includes('login'))
        ) {
          // Invalidate cached token and retry once
          this.activeToken = null;
          this.tokenExpiresAt = 0;
          return this.post<T>(endpoint, params, false);
        }
      }

      return json as T;
    } catch (err: any) {
      if (retryOnAuthFailure && err instanceof EcommerceHttpError && err.getStatus() === HttpStatus.UNAUTHORIZED) {
        this.activeToken = null;
        this.tokenExpiresAt = 0;
        return this.post<T>(endpoint, params, false);
      }
      throw err;
    }
  }
}
