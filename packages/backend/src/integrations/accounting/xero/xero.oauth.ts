import {
  AccountingAuthError,
  AccountingTokenStore,
} from '../core';
import { XERO_CAPABILITIES } from './xero.capabilities';

export interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface XeroOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class XeroOAuth {
  private static readonly AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
  private static readonly TOKEN_URL = 'https://identity.xero.com/connect/token';
  private static readonly SCOPES = [
    'offline_access',
    'accounting.transactions',
    'accounting.contacts',
    'accounting.settings',
  ].join(' ');

  constructor(
    private readonly config: XeroOAuthConfig,
    private readonly tokenStore: AccountingTokenStore = new AccountingTokenStore(),
  ) {}

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: XeroOAuth.SCOPES,
      state,
    });
    return `${XeroOAuth.AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<XeroTokenResponse> {
    const basicAuth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
    });

    try {
      const res = await fetch(XeroOAuth.TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        // Mask clientSecret in any error output
        const safeError = errorText.replace(new RegExp(this.config.clientSecret, 'g'), '***');
        throw new Error(`Token exchange failed (HTTP ${res.status}): ${safeError}`);
      }

      return (await res.json()) as XeroTokenResponse;
    } catch (err: any) {
      throw new AccountingAuthError('xero', err.message);
    }
  }

  async refreshTokensWithPolicy(options: {
    key: string;
    currentRefreshToken: string;
    saveTokensFn?: (tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    }) => Promise<void>;
    markReauthRequiredFn?: (reason: string) => Promise<void>;
  }): Promise<import('../core/AccountingTokenStore').CachedToken> {
    const basicAuth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    return this.tokenStore.rotateTokenWithPolicy({
      key: options.key,
      provider: 'xero',
      providerDisplayName: 'Xero',
      semantics: XERO_CAPABILITIES.refreshSemantics!,
      currentRefreshToken: options.currentRefreshToken,
      saveTokensFn: options.saveTokensFn,
      markReauthRequiredFn: options.markReauthRequiredFn,
      refreshCall: async (rt: string) => {
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: rt,
        });

        const res = await fetch(XeroOAuth.TOKEN_URL, {
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
          const safeError = String(errMsg).replace(new RegExp(this.config.clientSecret, 'g'), '***');
          const errorObj: any = new Error(`Xero token refresh failed (HTTP ${res.status}): ${safeError}`);
          errorObj.error = errData.error;
          errorObj.status = res.status;
          throw errorObj;
        }

        const data = (await res.json()) as XeroTokenResponse;
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        };
      },
    });
  }
}
