import { AccountingAuthError } from '../core/AccountingErrors';
import { AccountingTokenStore, CachedToken } from '../core/AccountingTokenStore';
import { BusinessCentralCredentials } from './bc.types';

export interface BusinessCentralTokenResponse {
  token_type: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
}

export class BusinessCentralAuth {
  constructor(private readonly tokenStore: AccountingTokenStore) {}

  /**
   * Resolve OAuth2 client credentials.
   * Prefers per-tenant credentials if provided, falls back to system environment variables.
   */
  resolveClientCredentials(credentials: BusinessCentralCredentials): {
    clientId: string;
    clientSecret: string;
  } {
    const clientId =
      credentials.clientId?.trim() || process.env.BC_ONLINE_CLIENT_ID?.trim();
    const clientSecret =
      credentials.clientSecret?.trim() || process.env.BC_ONLINE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      throw new AccountingAuthError(
        'MS_DYNAMICS_BC_ONLINE',
        'Business Central Entra ID kimlik bilgileri (Client ID / Client Secret) yapılandırılmamış.',
      );
    }

    return { clientId, clientSecret };
  }

  /**
   * Single-flight token retrieval keyed by aadTenantId (§4.6).
   * Prevents concurrent refresh stampedes when multiple requests hit the same tenant.
   */
  async getAccessToken(
    credentials: BusinessCentralCredentials,
    fetchFn?: (url: string, init: RequestInit) => Promise<Response>,
  ): Promise<string> {
    const aadTenantId = credentials.aadTenantId?.trim();
    if (!aadTenantId) {
      throw new AccountingAuthError(
        'MS_DYNAMICS_BC_ONLINE',
        'Microsoft Entra Directory (Tenant) ID belirtilmemiş.',
      );
    }

    const cacheKey = `bc_online_token_${aadTenantId}`;

    const cached = await this.tokenStore.getOrRefreshToken(cacheKey, async (): Promise<CachedToken> => {
      const { clientId, clientSecret } = this.resolveClientCredentials(credentials);
      return this.requestToken(aadTenantId, clientId, clientSecret, fetchFn);
    });

    return cached.accessToken;
  }

  /**
   * Request client_credentials token from Entra ID v2.0 endpoint.
   */
  async requestToken(
    aadTenantId: string,
    clientId: string,
    clientSecret: string,
    fetchFn: (url: string, init: RequestInit) => Promise<Response> = fetch,
  ): Promise<CachedToken> {
    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(aadTenantId)}/oauth2/v2.0/token`;

    const bodyParams = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://api.businesscentral.dynamics.com/.default',
    });

    let res: Response;
    try {
      res = await fetchFn(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });
    } catch (err: any) {
      throw new AccountingAuthError(
        'MS_DYNAMICS_BC_ONLINE',
        `Entra ID token sunucusuna bağlanılamadı: ${err.message}`,
      );
    }

    if (!res.ok) {
      let errBody: any;
      try {
        errBody = await res.json();
      } catch {
        errBody = null;
      }
      const desc = errBody?.error_description || errBody?.error || `HTTP ${res.status}`;
      // Never leak client_secret in error messages
      throw new AccountingAuthError(
        'MS_DYNAMICS_BC_ONLINE',
        `Entra ID kimlik doğrulama hatası (${res.status}): ${desc}`,
      );
    }

    const data = (await res.json()) as BusinessCentralTokenResponse;
    const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600;

    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresInSec * 1000,
    };
  }
}
