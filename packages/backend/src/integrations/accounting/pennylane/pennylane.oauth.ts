import { AccountingTokenStore } from '../core/AccountingTokenStore';

export interface PennylaneTokenState {
  apiToken: string;
  updatedAt: number;
}

/**
 * Pennylane API v2 Token Yöneticisi (§2.3, §7)
 *
 * Şirkete özel Bearer token'ları saklar ve AccountingTokenStore ile entegre çalışır.
 */
export class PennylaneTokenManager {
  private static readonly tokenCache = new Map<string, PennylaneTokenState>();

  static async setToken(
    tenantOrIntegrationId: string,
    apiToken: string,
    tokenStore?: AccountingTokenStore,
  ): Promise<void> {
    this.tokenCache.set(tenantOrIntegrationId, {
      apiToken,
      updatedAt: Date.now(),
    });

    if (tokenStore) {
      await tokenStore.setToken(tenantOrIntegrationId, {
        accessToken: apiToken,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 gün
      });
    }
  }

  static async getToken(
    tenantOrIntegrationId: string,
    tokenStore?: AccountingTokenStore,
  ): Promise<string | null> {
    const memory = this.tokenCache.get(tenantOrIntegrationId);
    if (memory) {
      return memory.apiToken;
    }

    if (tokenStore) {
      const stored = await tokenStore.getToken(tenantOrIntegrationId);
      if (stored?.accessToken) {
        return stored.accessToken;
      }
    }

    return null;
  }

  static clearCache(): void {
    this.tokenCache.clear();
  }
}
