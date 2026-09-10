import { AccountingTokenStore } from '../core/AccountingTokenStore';
import { QBO_CAPABILITIES } from './qbo.capabilities';

export interface QBOOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  realmId?: string;
}

export class QBOOAuthManager {
  public static readonly AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
  public static readonly TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  public static readonly DEFAULT_SCOPES = 'com.intuit.quickbooks.accounting openid profile email';

  constructor(private readonly tokenStore: AccountingTokenStore) {}

  /**
   * Generates Intuit OAuth2 authorization URL.
   * NOTE: com.intuit.quickbooks.payment is strictly omitted per §3.1 & §9.
   */
  getAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    state: string,
    scopes: string = QBOOAuthManager.DEFAULT_SCOPES,
  ): string {
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: scopes,
      redirect_uri: redirectUri,
      state: state,
    });
    return `${QBOOAuthManager.AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for tokens.
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    clientId: string,
    clientSecret: string,
    realmId?: string,
    fetchFn: typeof fetch = fetch,
  ): Promise<QBOOAuthTokens> {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    const res = await fetchFn(QBOOAuthManager.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`QuickBooks Online token değişimi başarısız oldu (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as any;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
      realmId: realmId || json.realmId,
    };
  }

  /**
   * Refreshes access token via central AccountingTokenStore with QBO semantics.
   * staleTokenUseIsDestructive: true guarantees no retries with old refresh token.
   */
  async getOrRefreshToken(options: {
    key: string;
    currentRefreshToken?: string;
    clientId: string;
    clientSecret: string;
    saveTokensFn?: (payload: { accessToken: string; refreshToken: string; expiresAt: number }) => Promise<void>;
    markReauthRequiredFn?: (reason: string) => Promise<void>;
    fetchFn?: typeof fetch;
  }): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> {
    const { key, currentRefreshToken, clientId, clientSecret, saveTokensFn, markReauthRequiredFn, fetchFn = fetch } = options;

    return await this.tokenStore.rotateTokenWithPolicy({
      key,
      provider: 'quickbooks',
      semantics: QBO_CAPABILITIES.refreshSemantics!,
      currentRefreshToken,
      saveTokensFn,
      markReauthRequiredFn,
      refreshCall: async (rt: string) => {
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: rt,
        });

        const res = await fetchFn(QBOOAuthManager.TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basicAuth}`,
            Accept: 'application/json',
          },
          body: body.toString(),
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as any;
          const err: any = new Error(errData.error_description || errData.error || `HTTP ${res.status}`);
          err.status = res.status;
          err.error = errData.error;
          throw err;
        }

        const data = (await res.json()) as any;
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        };
      },
    });
  }
}
