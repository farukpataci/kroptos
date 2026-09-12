/**
 * Fatture in Cloud (TeamSystem) OAuth 2.0 Flow
 * Reference: FIC Developer Guide "OAuth 2.0" & §3.4, §11.2 c
 */

import { AccountingAuthError } from '../core/AccountingErrors';
import { FIC_PROVIDER_NAME, FicOAuthTokenResponse } from './fic.types';

export const FIC_OAUTH_AUTHORIZE_URL = 'https://api-v2.fattureincloud.it/oauth/authorize';
export const FIC_OAUTH_TOKEN_URL = 'https://api-v2.fattureincloud.it/oauth/token';

export const FIC_DEFAULT_SCOPES = [
  'entity:r',
  'entity:w',
  'issued_documents.invoices:r',
  'issued_documents.invoices:w',
  'issued_documents.quotes:r',
  'issued_documents.quotes:w',
  'issued_documents.credit_notes:r',
  'issued_documents.credit_notes:w',
  'receipts:r',
  'receipts:w',
  'taxes:r',
  'archive:r',
].join(' ');

export interface FicOAuthUrlParams {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}

export interface FicOAuthExchangeParams {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}

export interface FicOAuthRefreshParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Builds browser authorization URL for Fatture in Cloud OAuth2 code flow.
 */
export function buildFicAuthorizationUrl(params: FicOAuthUrlParams): string {
  if (!params.clientId || !params.redirectUri || !params.state) {
    throw new AccountingAuthError(
      FIC_PROVIDER_NAME,
      'Fatture in Cloud OAuth authorization URL üretilemedi: clientId, redirectUri ve state zorunludur.',
    );
  }

  const url = new URL(FIC_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId.trim());
  url.searchParams.set('redirect_uri', params.redirectUri.trim());
  url.searchParams.set('scope', params.scope?.trim() || FIC_DEFAULT_SCOPES);
  url.searchParams.set('state', params.state.trim());

  return url.toString();
}

/**
 * Exchanges authorization code for access and refresh tokens.
 */
export async function exchangeFicAuthorizationCode(
  params: FicOAuthExchangeParams,
  fetchFn: (url: string, init?: any) => Promise<any> = fetch,
): Promise<FicOAuthTokenResponse> {
  const { clientId, clientSecret, code, redirectUri } = params;

  if (!clientId || !clientSecret || !code || !redirectUri) {
    throw new AccountingAuthError(
      FIC_PROVIDER_NAME,
      'Fatture in Cloud OAuth code değişimi yapılamadı: Eksik parametreler.',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    code: code.trim(),
    redirect_uri: redirectUri.trim(),
  });

  try {
    const res = await fetchFn(FIC_OAUTH_TOKEN_URL, {
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

    return (await res.json()) as FicOAuthTokenResponse;
  } catch (err: any) {
    throw new AccountingAuthError(
      FIC_PROVIDER_NAME,
      `Fatture in Cloud token değişimi başarısız: ${err.message}`,
    );
  }
}

/**
 * Refreshes expired access token using refresh token.
 * Note: FIC returns a new refresh token on every exchange (rotatesOnRefresh: true).
 */
export async function refreshFicAccessToken(
  params: FicOAuthRefreshParams,
  fetchFn: (url: string, init?: any) => Promise<any> = fetch,
): Promise<FicOAuthTokenResponse> {
  const { clientId, clientSecret, refreshToken } = params;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new AccountingAuthError(
      FIC_PROVIDER_NAME,
      'Fatture in Cloud token yenileme yapılamadı: clientId, clientSecret veya refreshToken eksik.',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    refresh_token: refreshToken.trim(),
  });

  try {
    const res = await fetchFn(FIC_OAUTH_TOKEN_URL, {
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

    return (await res.json()) as FicOAuthTokenResponse;
  } catch (err: any) {
    throw new AccountingAuthError(
      FIC_PROVIDER_NAME,
      `Fatture in Cloud token yenileme başarısız: ${err.message}`,
    );
  }
}
