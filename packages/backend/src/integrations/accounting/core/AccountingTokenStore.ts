import { Injectable } from '@nestjs/common';

export interface CachedToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
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
   * Single-flight token retrieval/refresh to prevent concurrent refresh stampedes.
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

  clear(): void {
    this.cache.clear();
    this.inFlightRefreshes.clear();
  }
}
