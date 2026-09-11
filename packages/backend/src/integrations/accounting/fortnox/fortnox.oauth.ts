import * as crypto from 'crypto';
import {
  FORTNOX_OAUTH_AUTH_URL,
  FORTNOX_OAUTH_TOKEN_URL,
} from './fortnox.client';
import { FortnoxOAuthTokenResponse, FortnoxSessionState } from './fortnox.types';

export const FORTNOX_AUTHORIZED_SCOPES = [
  'invoice',
  'customer',
  'article',
  'payment',
  'bookkeeping',
] as const;

export type FortnoxScope = (typeof FORTNOX_AUTHORIZED_SCOPES)[number];

export class FortnoxOAuthManager {
  private static readonly NONCE_TTL_MS = 8 * 60 * 1000; // 8 minutes (< 10 minutes, §5.1)
  private readonly stateStore = new Map<string, FortnoxSessionState>();
  private readonly usedCodes = new Set<string>();

  /**
   * Build the OAuth 2.0 authorization URL
   */
  buildAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    tenantId: string;
    storeId: string;
    scopes?: FortnoxScope[];
  }): { url: string; state: string } {
    const nonce = crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    const sessionState: FortnoxSessionState = {
      nonce,
      tenantId: params.tenantId,
      storeId: params.storeId,
      createdAt: now,
      expiresAt: now + FortnoxOAuthManager.NONCE_TTL_MS,
      used: false,
    };

    this.stateStore.set(nonce, sessionState);

    // Scopes: strictly only needed scopes (§5.2)
    const scopesToRequest = params.scopes ?? [...FORTNOX_AUTHORIZED_SCOPES];
    // Enforce least-privilege: reject if any scope is not in authorized list
    for (const s of scopesToRequest) {
      if (!FORTNOX_AUTHORIZED_SCOPES.includes(s)) {
        throw new Error(
          `[FortnoxOAuth] Unauthorized scope requested: '${s}'. Allowed scopes: ${FORTNOX_AUTHORIZED_SCOPES.join(', ')}`,
        );
      }
    }

    const queryParams = new URLSearchParams({
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      scope: scopesToRequest.join(' '),
      state: nonce,
      response_type: 'code',
      access_type: 'offline', // Required by Fortnox for refresh_token
    });

    return {
      url: `${FORTNOX_OAUTH_AUTH_URL}?${queryParams.toString()}`,
      state: nonce,
    };
  }

  /**
   * Validate state/nonce from OAuth callback (§5.1)
   * Must be valid, unexpired, and unused. Single-use.
   */
  validateState(nonce: string): FortnoxSessionState {
    const session = this.stateStore.get(nonce);
    if (!session) {
      throw new Error(`[FortnoxOAuth] Invalid or unrecognized state nonce`);
    }

    if (session.used) {
      throw new Error(`[FortnoxOAuth] State nonce has already been consumed (replay attempt blocked)`);
    }

    if (Date.now() > session.expiresAt) {
      this.stateStore.delete(nonce);
      throw new Error(`[FortnoxOAuth] State nonce has expired (> 8 minutes)`);
    }

    // Mark used immediately
    session.used = true;
    this.stateStore.delete(nonce);
    return session;
  }

  /**
   * Mark authorization code as used and prevent replay (§5.1)
   */
  consumeAuthorizationCode(code: string): void {
    if (this.usedCodes.has(code)) {
      throw new Error(
        `[FortnoxOAuth] Authorization code has already been consumed. Fortnox authorization codes are single-use.`,
      );
    }
    this.usedCodes.add(code);
  }

  /**
   * Helper to check if a code was already used
   */
  isCodeUsed(code: string): boolean {
    return this.usedCodes.has(code);
  }

  /**
   * Clean expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [nonce, session] of this.stateStore.entries()) {
      if (now > session.expiresAt || session.used) {
        this.stateStore.delete(nonce);
      }
    }
  }
}
