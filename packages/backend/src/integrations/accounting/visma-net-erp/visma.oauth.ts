import { AccountingAuthError } from '../core/AccountingErrors';
import { AccountingTokenStore, CachedToken } from '../core/AccountingTokenStore';
import { VISMA_CAPABILITIES } from './visma.capabilities';

export const VISMA_AUTH_URL = 'https://connect.visma.com/connect/authorize';
export const VISMA_TOKEN_URL = 'https://connect.visma.com/connect/token';
export const VISMA_DEFAULT_SCOPES = 'vismanet_erp_service_api openid profile email offline_access';

export interface VismaOAuthConfig {
  clientId?: string;
  clientSecret?: string;
}

export interface VismaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export class VismaNetOAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    config: VismaOAuthConfig,
    private readonly tokenStore: AccountingTokenStore,
  ) {
    this.clientId = config.clientId || process.env.VISMA_CLIENT_ID || 'visma_mock_client_id';
    this.clientSecret = config.clientSecret || process.env.VISMA_CLIENT_SECRET || 'visma_mock_secret';
  }

  getAuthorizationUrl(state: string, redirectUri: string, scope = VISMA_DEFAULT_SCOPES): string {
    const url = new URL(VISMA_AUTH_URL);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scope);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<VismaTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    try {
      const res = await fetch(VISMA_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new AccountingAuthError(
          'VISMA-NET-ERP',
          `Visma Connect authorization_code takası başarısız (${res.status}): ${errorText}`,
        );
      }

      return (await res.json()) as VismaTokenResponse;
    } catch (err: any) {
      if (err instanceof AccountingAuthError) throw err;
      throw new AccountingAuthError(
        'VISMA-NET-ERP',
        `Visma Connect belirteç isteği başarısız: ${err.message}`,
      );
    }
  }

  async getValidTokenWithRotation(options: {
    key: string;
    currentRefreshToken: string;
    saveTokensFn?: (tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    }) => Promise<void>;
    markReauthRequiredFn?: (reason: string) => Promise<void>;
  }): Promise<CachedToken> {
    return this.tokenStore.rotateTokenWithPolicy({
      key: options.key,
      provider: 'VISMA-NET-ERP',
      providerDisplayName: 'Visma.net ERP',
      semantics: VISMA_CAPABILITIES.refreshSemantics!,
      currentRefreshToken: options.currentRefreshToken,
      saveTokensFn: options.saveTokensFn,
      markReauthRequiredFn: options.markReauthRequiredFn,
      refreshCall: async (refreshToken: string) => {
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        });

        const res = await fetch(VISMA_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: body.toString(),
        });

        if (!res.ok) {
          const safeError = await res.text();
          throw new Error(`Visma.net ERP token yenileme başarısız (HTTP ${res.status}): ${safeError}`);
        }

        const data = (await res.json()) as VismaTokenResponse;
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken,
          expiresIn: data.expires_in,
        };
      },
    });
  }
}
