import { AccountingAuthError } from '../core/AccountingErrors';

export class KolaybiAuthManager {
  private cachedToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private pendingAuthPromise: Promise<string> | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly channel: string,
  ) {}

  async getToken(authenticateFn: () => Promise<{ token: string; expiresInSeconds?: number }>): Promise<string> {
    if (this.cachedToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    if (this.pendingAuthPromise) {
      return this.pendingAuthPromise;
    }

    this.pendingAuthPromise = (async () => {
      try {
        const { token, expiresInSeconds } = await authenticateFn();
        this.cachedToken = token;
        this.tokenExpiresAt = expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : null;
        return token;
      } catch (err: any) {
        this.cachedToken = null;
        this.tokenExpiresAt = null;
        throw new AccountingAuthError('KOLAYBI', `KolayBi kimlik doğrulama başarısız: ${err.message}`);
      } finally {
        this.pendingAuthPromise = null;
      }
    })();

    return this.pendingAuthPromise;
  }

  clearToken(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = null;
  }
}
