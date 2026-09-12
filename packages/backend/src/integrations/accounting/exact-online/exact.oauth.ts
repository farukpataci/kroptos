import { AccountingAuthError } from '../core/AccountingErrors';
import { AccountingTokenStore, CachedToken } from '../core/AccountingTokenStore';
import { EXACT_CAPABILITIES } from './exact.capabilities';
import { ExactCountry, ExactTokenResponse, EXACT_REGIONAL_CONFIGS } from './exact.types';

export interface ExactOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  country?: ExactCountry;
}

export class ExactOnlineOAuth {
  private readonly country: ExactCountry;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    config: ExactOAuthConfig,
    private readonly tokenStore: AccountingTokenStore,
  ) {
    this.country = config.country || 'NL';
    this.clientId = config.clientId || process.env.EXACT_ONLINE_CLIENT_ID || 'exact_mock_client_id';
    this.clientSecret = config.clientSecret || process.env.EXACT_ONLINE_CLIENT_SECRET || 'exact_mock_secret';
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const regional = EXACT_REGIONAL_CONFIGS[this.country] || EXACT_REGIONAL_CONFIGS.NL;
    const url = new URL(regional.authUrl);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<ExactTokenResponse> {
    const regional = EXACT_REGIONAL_CONFIGS[this.country] || EXACT_REGIONAL_CONFIGS.NL;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    try {
      const res = await fetch(regional.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      return (await res.json()) as ExactTokenResponse;
    } catch (err: any) {
      throw new AccountingAuthError('EXACT-ONLINE', err.message);
    }
  }

  /**
   * Universal Single-Flight Refresh with Exact 570s Window Guard (§3.5, §4, §5.3, §5.4):
   * 1. 570 saniyeden erken yenileme denemesi yapılmaz (erken yenileme Exact API tarafından 400 ile reddedilir).
   * 2. Single-flight mutex garantisi.
   * 3. Tek kullanımlık refresh token rotasyonu: Yaz-sonra-kullan sırası.
   */
  async getValidTokenWithRotation(options: {
    key: string;
    currentRefreshToken: string;
    tokenIssuedAt?: number;
    saveTokensFn: (tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    }) => Promise<void>;
    markReauthRequiredFn?: (reason: string) => Promise<void>;
  }): Promise<CachedToken> {
    const regional = EXACT_REGIONAL_CONFIGS[this.country] || EXACT_REGIONAL_CONFIGS.NL;
    const now = Date.now();

    // §3.5 & §5.3 Erken Yenileme Guard'ı
    if (options.tokenIssuedAt) {
      const earliestRefreshMs = EXACT_CAPABILITIES.refreshSemantics?.earliestRefreshAfterMs || 570_000;
      const elapsed = now - options.tokenIssuedAt;
      if (elapsed < earliestRefreshMs) {
        const waitSec = Math.round((earliestRefreshMs - elapsed) / 1000);
        throw new AccountingAuthError(
          'EXACT-ONLINE',
          `Exact Online token erken yenileme engeli: Token ancak 570 saniye geçtikten sonra yenilenebilir. Kalan bekleme süresi: ${waitSec}s.`,
        );
      }
    }

    return this.tokenStore.rotateTokenWithPolicy({
      key: options.key,
      provider: 'EXACT-ONLINE',
      providerDisplayName: 'Exact Online',
      semantics: EXACT_CAPABILITIES.refreshSemantics!,
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

        const res = await fetch(regional.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: body.toString(),
        });

        if (!res.ok) {
          const safeError = await res.text();
          throw new Error(`Exact Online token yenileme başarısız (HTTP ${res.status}): ${safeError}`);
        }

        const data = (await res.json()) as ExactTokenResponse;
        const expiresIn = data.expires_in || 600;

        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + expiresIn * 1000,
        };
      },
    });
  }
}
