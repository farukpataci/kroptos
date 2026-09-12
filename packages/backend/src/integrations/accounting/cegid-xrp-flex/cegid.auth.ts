import { Injectable, Logger } from '@nestjs/common';
import { AccountingTokenStore } from '../core/AccountingTokenStore';
import { CEGID_REFRESH_SEMANTICS } from './cegid.capabilities';
import { CegidTokenResponse } from './cegid.types';
import { CegidUriHelper } from './cegid.uri';

export interface CegidAuthCredentials {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  tokenUrl?: string;
  scope?: string;
}

@Injectable()
export class CegidAuthService {
  private readonly logger = new Logger(CegidAuthService.name);

  constructor(private readonly tokenStore?: AccountingTokenStore) {}

  /**
   * OAuth 2.0 Password Grant ile access_token alır veya saklanan geçerli token'ı döner (§2.b, §6.3).
   */
  async getValidToken(
    integrationId: string,
    credentials: CegidAuthCredentials,
    httpClient?: (url: string, body: string, headers: Record<string, string>) => Promise<any>,
  ): Promise<string> {
    // 1. Token deposundan mevcut token'ı kontrol et
    if (this.tokenStore && integrationId) {
      const stored = this.tokenStore.getToken(integrationId);
      if (stored && stored.accessToken) {
        return stored.accessToken;
      }
    }

    // 2. Yeni token al (Password Grant)
    const tokenResponse = await this.requestPasswordGrant(credentials, httpClient);

    // 3. Token deposuna kaydet
    if (this.tokenStore && integrationId) {
      const expiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
      this.tokenStore.setToken(integrationId, {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt,
      });
    }

    return tokenResponse.access_token;

  }

  /**
   * Cegid XRP Flex OAuth 2.0 Password Grant POST isteği (§2.b, GetToken.cs kalıbı)
   */
  async requestPasswordGrant(
    credentials: CegidAuthCredentials,
    httpClient?: (url: string, body: string, headers: Record<string, string>) => Promise<any>,
  ): Promise<CegidTokenResponse> {
    const tokenUrl = CegidUriHelper.getTokenUrl(
      credentials.instanceUrl,
      credentials.tokenUrl,
    );

    // Host doğrulaması yapılmış tokenUrl
    CegidUriHelper.validateHost(tokenUrl, credentials.instanceUrl);

    const bodyParams = new URLSearchParams({
      grant_type: 'password',
      username: credentials.username,
      password: credentials.password,
      scope: credentials.scope || 'api',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });

    const headers: Record<string, string> = {
      'cache-control': 'no-cache',
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    };

    if (httpClient) {
      return await httpClient(tokenUrl, bodyParams.toString(), headers);
    }

    // Gerçek ağ isteği (MOCK_READY seviyesinde doğrudan çağrılmaz)
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`[CegidAuth] Kimlik doğrulama başarısız (${res.status}): ${errorText}`);
      throw new Error(`[CegidAuth] Kimlik doğrulama başarısız: HTTP ${res.status}`);
    }

    return (await res.json()) as CegidTokenResponse;
  }
}
