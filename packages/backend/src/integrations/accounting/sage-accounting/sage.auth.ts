import { AccountingAuthError } from '../core/AccountingErrors';
import { AccountingTokenStore, CachedToken } from '../core/AccountingTokenStore';
import { SageCredentials, SageOAuthTokenResponse } from './sage.types';

export type SaveTokensFn = (
  integrationId: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: number },
) => Promise<void>;

export type MarkReauthRequiredFn = (
  integrationId: string,
  reason: string,
) => Promise<void>;

export class SageAuth {
  constructor(
    private readonly tokenStore: AccountingTokenStore,
    private readonly saveTokensFn?: SaveTokensFn,
    private readonly markReauthRequiredFn?: MarkReauthRequiredFn,
  ) {}

  /**
   * Resolve Sage OAuth2 client credentials from credentials or environment variables.
   * Never leaks client_secret in error messages.
   */
  resolveAppCredentials(credentials?: Partial<SageCredentials>): {
    clientId: string;
    clientSecret: string;
  } {
    const clientId =
      credentials?.clientId?.trim() || process.env.SAGE_CLIENT_ID?.trim();
    const clientSecret =
      credentials?.clientSecret?.trim() || process.env.SAGE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      throw new AccountingAuthError(
        'sage-accounting',
        'Sage OAuth2 kimlik bilgileri (Client ID / Client Secret) yapılandırılmamış.',
      );
    }

    return { clientId, clientSecret };
  }

  /**
   * Single-flight token retrieval keyed by integrationId (§4.1).
   * Ensures atomic refresh, sequential DB write before use, and no duplicate concurrent refreshes.
   */
  async getAccessToken(
    integrationId: string,
    credentials: SageCredentials,
    fetchFn: (url: string, init: RequestInit) => Promise<Response> = fetch,
  ): Promise<string> {
    if (!integrationId) {
      throw new AccountingAuthError(
        'sage-accounting',
        'Entegrasyon kimliği (integrationId) belirtilmemiş.',
      );
    }

    const cacheKey = `sage_token_${integrationId}`;

    // 1. In-memory check
    const cached = this.tokenStore.getToken(cacheKey);
    if (cached) {
      return cached.accessToken;
    }

    // 2. Single-flight refresh stampede protection
    const token = await this.tokenStore.getOrRefreshToken(cacheKey, async (): Promise<CachedToken> => {
      // If we have an unexpired access token passed from DB credentials and not yet in memory store
      if (
        credentials.accessToken &&
        credentials.expiresAt &&
        Date.now() < credentials.expiresAt - 60000
      ) {
        return {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          expiresAt: credentials.expiresAt,
        };
      }

      // Must rotate using refresh token
      return this.rotateRefreshToken(integrationId, credentials, fetchFn);
    });

    return token.accessToken;
  }

  /**
   * §4.1 Rotating refresh token execution:
   * 1. Call Sage token endpoint.
   * 2. Commit new refresh token + access token to DB BEFORE returning.
   * 3. If commit fails, abort and throw immediately.
   * 4. If invalid_grant, do NOT retry; mark reauthorization required.
   */
  async rotateRefreshToken(
    integrationId: string,
    credentials: SageCredentials,
    fetchFn: (url: string, init: RequestInit) => Promise<Response> = fetch,
  ): Promise<CachedToken> {
    const currentRefreshToken =
      credentials.refreshToken?.trim() ||
      this.tokenStore.getToken(`sage_token_${integrationId}`)?.refreshToken;

    if (!currentRefreshToken) {
      if (this.markReauthRequiredFn) {
        await this.markReauthRequiredFn(integrationId, 'Missing refresh token');
      }
      throw new AccountingAuthError(
        'sage-accounting',
        'REAUTHORIZATION_REQUIRED: Sage refresh token bulunamadı. Lütfen yeniden bağlanın.',
      );
    }

    const { clientId, clientSecret } = this.resolveAppCredentials(credentials);
    const cacheKey = `sage_token_${integrationId}`;

    const token = await this.tokenStore.rotateTokenWithPolicy({
      key: cacheKey,
      provider: 'sage-accounting',
      semantics: {
        rotatesOnRefresh: true,
        previousTokenGraceMs: 0,
        inactivityLimitDays: 31,
        staleTokenUseIsDestructive: false,
      },
      currentRefreshToken,
      refreshCall: async (refreshToken) => {
        const tokenUrl = 'https://oauth.accounting.sage.com/token';
        const bodyParams = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
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
            'sage-accounting',
            `Sage token sunucusuna bağlanılamadı: ${err.message}`,
          );
        }

        if (!res.ok) {
          let errBody: any;
          try {
            errBody = await res.json();
          } catch {
            errBody = null;
          }
          const errCode = errBody?.error || '';
          const errDesc = errBody?.error_description || `HTTP ${res.status}`;

          if (
            errCode === 'invalid_grant' ||
            res.status === 400 ||
            res.status === 401
          ) {
            const errorObj: any = new Error(errDesc);
            errorObj.error = 'invalid_grant';
            errorObj.status = res.status;
            throw errorObj;
          }

          throw new AccountingAuthError(
            'sage-accounting',
            `Sage token yenileme hatası (${res.status}): ${errDesc}`,
          );
        }

        const data = (await res.json()) as SageOAuthTokenResponse;
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 300,
        };
      },
      saveTokensFn: this.saveTokensFn
        ? (tokens) => this.saveTokensFn!(integrationId, tokens)
        : undefined,
      markReauthRequiredFn: this.markReauthRequiredFn
        ? (reason) => this.markReauthRequiredFn!(integrationId, reason)
        : undefined,
    });

    credentials.accessToken = token.accessToken;
    credentials.refreshToken = token.refreshToken;
    credentials.expiresAt = token.expiresAt;

    return token;
  }

  /**
   * Execute request with auth and one-time 401 retry protection (§4.4)
   */
  async executeWithAuth<T>(
    integrationId: string,
    credentials: SageCredentials,
    requestFn: (token: string) => Promise<T>,
    fetchFn: (url: string, init: RequestInit) => Promise<Response> = fetch,
  ): Promise<T> {
    const token = await this.getAccessToken(integrationId, credentials, fetchFn);

    try {
      return await requestFn(token);
    } catch (err: any) {
      // Check for 401 Unauthorized
      if (err?.status === 401 || err?.statusCode === 401 || err?.message?.includes('401')) {
        // Invalidate token from store
        this.tokenStore.deleteToken(`sage_token_${integrationId}`);
        // Clear expired accessToken from credentials so getAccessToken forces rotate
        credentials.accessToken = undefined;
        credentials.expiresAt = 0;

        const refreshedToken = await this.getAccessToken(integrationId, credentials, fetchFn);
        // Single retry only - infinite loop protection
        return await requestFn(refreshedToken);
      }
      throw err;
    }
  }
}
