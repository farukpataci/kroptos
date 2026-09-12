import { ISevdeskClient } from './sevdesk.client';
import { SevdeskUser } from './sevdesk.types';

export interface SevdeskTokenOwner {
  id: string | number;
  username: string;
  fullname: string;
  email: string;
  status: number;
}

export interface SevdeskHealthCheckResult {
  healthy: boolean;
  tokenOwner?: SevdeskTokenOwner;
  lastCheckedAt: string;
  errorMessage?: string;
  reauthorizationRequired?: boolean;
}

export class SevdeskHealthService {
  /**
   * §4 Resolves token owner by calling getCurrentUser().
   */
  static async resolveTokenOwner(client: ISevdeskClient): Promise<SevdeskTokenOwner> {
    const user: SevdeskUser = await client.getCurrentUser();
    return {
      id: user.id,
      username: user.username || 'unknown',
      fullname: user.fullname || user.username || 'sevDesk User',
      email: user.email || '',
      status: user.status ?? 100,
    };
  }

  /**
   * §4 Periodic Health Check:
   * Validates if the token is still functional.
   * If the token fails (e.g. 401 Unauthorized because user was deleted/revoked),
   * reports healthy: false and reauthorizationRequired: true.
   */
  static async checkHealth(client: ISevdeskClient): Promise<SevdeskHealthCheckResult> {
    const now = new Date().toISOString();
    try {
      const owner = await this.resolveTokenOwner(client);
      return {
        healthy: true,
        tokenOwner: owner,
        lastCheckedAt: now,
      };
    } catch (err: any) {
      return {
        healthy: false,
        lastCheckedAt: now,
        errorMessage: err?.message || 'Token doğrulanamadı',
        reauthorizationRequired: true,
      };
    }
  }
}
