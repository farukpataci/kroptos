import { Injectable } from '@nestjs/common';
import { AccountingAuthError } from './AccountingErrors';
import { RefreshSemantics } from './AccountingTokenSemantics';

export interface CachedToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

export interface SaveTokensPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export type SaveTokensFn = (payload: SaveTokensPayload) => Promise<void>;
export type MarkReauthRequiredFn = (reason: string) => Promise<void>;

export interface RotateTokenPolicyOptions {
  key: string;
  provider: string;
  semantics: RefreshSemantics;
  currentRefreshToken?: string;
  refreshCall: (refreshToken: string) => Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
  }>;
  saveTokensFn?: SaveTokensFn;
  markReauthRequiredFn?: MarkReauthRequiredFn;
  providerDisplayName?: string;
  maxGraceRetries?: number;
  backoffBaseMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

@Injectable()
export class AccountingTokenStore {
  private cache: Map<string, CachedToken> = new Map();
  private inFlightRefreshes: Map<string, Promise<CachedToken>> = new Map();

  getToken(key: string): CachedToken | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;

    // Buffer 60 seconds before expiration
    if (Date.now() >= cached.expiresAt - 60000) {
      return undefined;
    }
    return cached;
  }

  setToken(key: string, token: CachedToken): void {
    this.cache.set(key, token);
  }

  deleteToken(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Single-flight token retrieval/refresh to prevent concurrent refresh stampedes (§2.2).
   */
  async getOrRefreshToken(
    key: string,
    refreshFn: () => Promise<CachedToken>,
  ): Promise<CachedToken> {
    const existing = this.getToken(key);
    if (existing) {
      return existing;
    }

    const inFlight = this.inFlightRefreshes.get(key);
    if (inFlight) {
      return inFlight;
    }

    const refreshPromise = (async () => {
      try {
        const token = await refreshFn();
        this.setToken(key, token);
        return token;
      } finally {
        this.inFlightRefreshes.delete(key);
      }
    })();

    this.inFlightRefreshes.set(key, refreshPromise);
    return refreshPromise;
  }

  /**
   * Universal Rotating Refresh Token execution with Semantics Awareness (§2.1 & §2.2):
   * 1. Single-flight mutex per key.
   * 2. Missing refresh token -> immediate REAUTHORIZATION_REQUIRED.
   * 3. Tolerance / Grace period awareness (previousTokenGraceMs):
   *    - previousTokenGraceMs === 0 (Sage): no retry on transient error.
   *    - previousTokenGraceMs > 0 (Xero): retries transient network errors within grace window (max 3, exponential backoff).
   * 4. invalid_grant detection -> aborts without retry, marks reauth required.
   * 5. Write-then-use guarantee: saveTokensFn commit MUST succeed before token is returned or cached.
   */
  async rotateTokenWithPolicy(options: RotateTokenPolicyOptions): Promise<CachedToken> {
    const {
      key,
      provider,
      semantics,
      currentRefreshToken,
      refreshCall,
      saveTokensFn,
      markReauthRequiredFn,
      providerDisplayName,
      maxGraceRetries = 3,
      backoffBaseMs = 50,
      sleepFn = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    } = options;

    return this.getOrRefreshToken(key, async (): Promise<CachedToken> => {
      if (!currentRefreshToken) {
        if (markReauthRequiredFn) {
          await markReauthRequiredFn('Missing refresh token');
        }
        throw new AccountingAuthError(
          provider,
          `REAUTHORIZATION_REQUIRED: ${provider} refresh token bulunamadı. Lütfen yeniden bağlanın.`,
        );
      }

      const isInvalidGrantError = (err: any): boolean => {
        const msg = String(err?.message || '').toLowerCase();
        const errCode = String(err?.error || err?.code || '').toLowerCase();
        return (
          errCode === 'invalid_grant' ||
          msg.includes('invalid_grant') ||
          msg.includes('reauthorization_required') ||
          err?.status === 400 ||
          err?.status === 401
        );
      };

      let result: { accessToken: string; refreshToken: string; expiresIn?: number } | null = null;
      let lastError: any = null;

      const startTime = Date.now();
      let attempt = 0;

      while (attempt < maxGraceRetries) {
        attempt++;
        try {
          result = await refreshCall(currentRefreshToken);
          break;
        } catch (err: any) {
          lastError = err;

          // invalid_grant -> DO NOT RETRY (§2.2 rule 4)
          if (isInvalidGrantError(err)) {
            if (markReauthRequiredFn) {
              await markReauthRequiredFn(`invalid_grant: ${err?.message || 'Invalid or revoked token'}`);
            }
            throw new AccountingAuthError(
              provider,
              `REAUTHORIZATION_REQUIRED: ${provider} oturumu veya refresh token geçersiz kaldı (${err?.message || 'invalid_grant'}). Lütfen yeniden bağlanın.`,
            );
          }

          // If no grace period (Sage, semantics.previousTokenGraceMs === 0), do NOT retry with old token!
          if (!semantics.previousTokenGraceMs || semantics.previousTokenGraceMs <= 0) {
            throw err;
          }

          // Provider has grace tolerance (Xero, previousTokenGraceMs > 0)
          const elapsed = Date.now() - startTime;
          if (elapsed >= semantics.previousTokenGraceMs || attempt >= maxGraceRetries) {
            throw err;
          }

          // Exponential backoff
          const backoff = backoffBaseMs * Math.pow(2, attempt - 1);
          await sleepFn(backoff);
        }
      }

      if (!result) {
        throw lastError || new AccountingAuthError(provider, `${provider} token yenilenemedi.`);
      }

      const expiresInSec = typeof result.expiresIn === 'number' ? result.expiresIn : 300;
      const expiresAt = Date.now() + expiresInSec * 1000;

      const newTokens: CachedToken = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt,
      };

      // Write-then-use order (§2.2 rule 2): commit to DB before returning or caching
      if (saveTokensFn) {
        try {
          await saveTokensFn({
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken!,
            expiresAt: newTokens.expiresAt,
          });
        } catch (saveErr: any) {
          this.deleteToken(key);
          const displayName = providerDisplayName || (provider.startsWith('sage') ? 'Sage' : (provider.charAt(0).toUpperCase() + provider.slice(1)));
          throw new AccountingAuthError(
            provider,
            `Kritik hata: Yeni ${displayName} refresh token veri tabanına kaydedilemedi (${saveErr.message}). İstek iptal edildi.`,
          );
        }
      }

      return newTokens;
    });
  }

  clear(): void {
    this.cache.clear();
    this.inFlightRefreshes.clear();
  }
}
