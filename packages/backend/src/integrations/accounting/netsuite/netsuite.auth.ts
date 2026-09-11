import { BadRequestException } from '@nestjs/common';
import { NetSuiteCredentials, NetSuiteTokenResponse, NetSuiteCachedToken } from './netsuite.types';
import { NetSuiteUriHelper } from './netsuite.uri';
import { NetSuiteJwtHelper } from './netsuite.jwt';

/**
 * NetSuite M2M OAuth 2.0 Kimlik Yöneticisi (§2.2, §4, §5.2)
 *
 * KRİTİK İLKELER:
 * 1. Refresh token YOKTUR (§4). Access token süresi dolunca imzalı JWT ile yeniden alınır.
 * 2. Token deposunun (AccountingTokenStore) refresh mekanizmasına HİÇ uğramaz (4. negatif test).
 * 3. Access token 60 dakika (veya expires_in) boyunca bellekte önbelleklenir.
 * 4. Sertifika süresi dolmuşsa yeni token alınması engellenir (§5.2).
 */
export class NetSuiteAuthService {
  private static tokenCache: Map<string, NetSuiteCachedToken> = new Map();

  /**
   * Önbellek anahtarı: accountId:clientId:certificateId
   */
  private static getCacheKey(credentials: NetSuiteCredentials): string {
    return `${credentials.accountId.trim().toLowerCase()}:${credentials.clientId.trim()}:${credentials.certificateId.trim()}`;
  }

  /**
   * Testler veya hesap sıfırlama için önbelleği temizler
   */
  static clearCache(credentials?: NetSuiteCredentials): void {
    if (credentials) {
      this.tokenCache.delete(this.getCacheKey(credentials));
    } else {
      this.tokenCache.clear();
    }
  }

  /**
   * Önbellekteki geçerli tokenı döner; yoksa null.
   */
  static getCachedAccessToken(credentials: NetSuiteCredentials): string | null {
    const key = this.getCacheKey(credentials);
    const cached = this.tokenCache.get(key);
    if (!cached) return null;

    // 60 saniyelik emniyet payı
    if (Date.now() + 60_000 >= cached.expiresAt) {
      this.tokenCache.delete(key);
      return null;
    }

    return cached.accessToken;
  }

  /**
   * Tokenı önbelleğe kaydeder
   */
  static setCachedToken(credentials: NetSuiteCredentials, token: string, expiresInSeconds: number): void {
    const key = this.getCacheKey(credentials);
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    this.tokenCache.set(key, {
      accessToken: token,
      expiresAt,
    });
  }

  /**
   * Token isteği için form-urlencoded gövdeyi hazırlar
   */
  static buildTokenRequestBody(assertionJwt: string): string {
    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    params.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    params.set('client_assertion', assertionJwt);
    return params.toString();
  }

  /**
   * Gerekli doğrulamaları yaparak yeni bir M2M access token temin eder veya önbellekten döner.
   */
  static async getValidAccessToken(
    credentials: NetSuiteCredentials,
    fetchFn?: (url: string, init: any) => Promise<any>,
  ): Promise<string> {
    // 1. Sertifika geçerlilik kontrolü (§5.2)
    const certCheck = NetSuiteJwtHelper.checkCertificateStatus(credentials.certificateExpiresAt);
    if (certCheck.isExpired) {
      throw new BadRequestException(
        `[NetSuite Auth] Sertifika geçerlilik süresi DOLDU (${credentials.certificateExpiresAt}). Güvenlik gereği token alınamaz.`,
      );
    }

    // 2. Önbellek kontrolü
    const cachedToken = this.getCachedAccessToken(credentials);
    if (cachedToken) {
      return cachedToken;
    }

    // 3. İmzalı JWT Assertion üretimi (§2.2, §5.2)
    const assertion = NetSuiteJwtHelper.generateClientAssertion({
      accountId: credentials.accountId,
      clientId: credentials.clientId,
      certificateId: credentials.certificateId,
      keyReference: credentials.keyReference,
    });

    const tokenUrl = NetSuiteUriHelper.getTokenUrl(credentials.accountId);
    const body = this.buildTokenRequestBody(assertion);

    // 4. Token isteği (Mock ortamında veya gerçek ağda)
    if (!fetchFn) {
      // Mock varsayılan üretimi
      const mockToken = `ns_mock_token_${Date.now()}`;
      this.setCachedToken(credentials, mockToken, 3600);
      return mockToken;
    }

    const response = await fetchFn(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(`[NetSuite Auth] Token alımı başarısız (${response.status}): ${errorText}`);
    }

    const data: NetSuiteTokenResponse = await response.json();
    this.setCachedToken(credentials, data.access_token, data.expires_in || 3600);
    return data.access_token;
  }
}
