import { AccountingAuthError, AccountingTokenStore } from '../core';
import { FREEAGENT_CAPABILITIES } from './freeagent.capabilities';
import { FreeAgentEnvironment } from './freeagent.types';

export interface FreeAgentTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // §5.7: Koda gömülmez, cevaptan okunur
  refresh_token: string;
  refresh_token_expires_in?: number;
}

export interface FreeAgentOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment?: FreeAgentEnvironment;
}

export class FreeAgentOAuth {
  constructor(
    private readonly config: FreeAgentOAuthConfig,
    private readonly tokenStore: AccountingTokenStore = new AccountingTokenStore(),
  ) {}

  private getAuthUrl(environment: FreeAgentEnvironment = 'MOCK'): string {
    return environment === 'PRODUCTION'
      ? 'https://api.freeagent.com/v2/approve_app'
      : 'https://api.sandbox.freeagent.com/v2/approve_app';
  }

  private getTokenUrl(environment: FreeAgentEnvironment = 'MOCK'): string {
    return environment === 'PRODUCTION'
      ? 'https://api.freeagent.com/v2/token_endpoint'
      : 'https://api.sandbox.freeagent.com/v2/token_endpoint';
  }

  /**
   * §2.2 OAuth2 Yetkilendirme URL'i oluşturur.
   */
  getAuthorizationUrl(state: string, environment?: FreeAgentEnvironment): string {
    const env = environment || this.config.environment || 'MOCK';
    const authBase = this.getAuthUrl(env);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
    });

    return `${authBase}?${params.toString()}`;
  }

  /**
   * §2.2 Authorization code -> token takası.
   * §5.7: expires_in doğrudan cevaptan okunur.
   */
  async exchangeCodeForTokens(
    code: string,
    environment?: FreeAgentEnvironment,
  ): Promise<FreeAgentTokenResponse> {
    const env = environment || this.config.environment || 'MOCK';
    const tokenUrl = this.getTokenUrl(env);

    const basicAuth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    });

    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        const safeError = errorText.replace(new RegExp(this.config.clientSecret, 'g'), '***');
        throw new Error(`Token takası başarısız (HTTP ${res.status}): ${safeError}`);
      }

      const data = (await res.json()) as FreeAgentTokenResponse;
      return data;
    } catch (err: any) {
      throw new AccountingAuthError('freeagent', err.message);
    }
  }

  /**
   * §4 & §5.7 RefreshSemantics dördüncü profili uyarınca token rotasyonu yürütür.
   * Yenileme cevabında hem yeni access_token hem yeni refresh_token döner.
   */
  async refreshTokensWithPolicy(options: {
    key: string;
    currentRefreshToken: string;
    environment?: FreeAgentEnvironment;
    saveTokensFn?: (tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    }) => Promise<void>;
    markReauthRequiredFn?: (reason: string) => Promise<void>;
  }): Promise<import('../core/AccountingTokenStore').CachedToken> {
    const env = options.environment || this.config.environment || 'MOCK';
    const tokenUrl = this.getTokenUrl(env);

    const basicAuth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    return this.tokenStore.rotateTokenWithPolicy({
      key: options.key,
      provider: 'freeagent',
      providerDisplayName: 'FreeAgent',
      semantics: FREEAGENT_CAPABILITIES.refreshSemantics!,
      currentRefreshToken: options.currentRefreshToken,
      saveTokensFn: options.saveTokensFn,
      markReauthRequiredFn: options.markReauthRequiredFn,
      refreshCall: async (rt: string) => {
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: rt,
        });

        const res = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });

        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          const errMsg = errData.error_description || errData.error || res.statusText;
          const safeError = String(errMsg).replace(
            new RegExp(this.config.clientSecret, 'g'),
            '***',
          );
          const errorObj: any = new Error(
            `FreeAgent token yenileme başarısız (HTTP ${res.status}): ${safeError}`,
          );
          errorObj.error = errData.error;
          errorObj.status = res.status;
          throw errorObj;
        }

        const data = (await res.json()) as FreeAgentTokenResponse;

        // §5.7: Token ömrü (expires_in) dinamik olarak cevaptan okunur; asla 3600 koda gömülmez.
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        };
      },
    });
  }
}
