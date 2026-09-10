import { AccountingAuthError } from '../core/AccountingErrors';
import { SageOAuthTokenResponse } from './sage.types';

export interface SageOAuthUrlParams {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}

export interface SageOAuthExchangeParams {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}

export const SAGE_OAUTH_AUTHORIZE_URL = 'https://www.sageone.com/oauth2/auth/central';
export const SAGE_OAUTH_TOKEN_URL = 'https://oauth.accounting.sage.com/token';
export const SAGE_DEFAULT_SCOPE = 'full_access';

/**
 * Builds the Sage OAuth2 browser authorization URL.
 */
export function buildSageAuthorizationUrl(params: SageOAuthUrlParams): string {
  if (!params.clientId || !params.redirectUri || !params.state) {
    throw new AccountingAuthError(
      'sage-accounting',
      'Sage OAuth authorization URL üretilemedi: clientId, redirectUri ve state zorunludur.',
    );
  }

  const url = new URL(SAGE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('filter', 'apiv3.1');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId.trim());
  url.searchParams.set('redirect_uri', params.redirectUri.trim());
  url.searchParams.set('scope', params.scope?.trim() || SAGE_DEFAULT_SCOPE);
  url.searchParams.set('state', params.state.trim());

  return url.toString();
}

/**
 * Exchanges authorization code for initial access and refresh tokens.
 */
export async function exchangeSageAuthorizationCode(
  params: SageOAuthExchangeParams,
  fetchFn: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<SageOAuthTokenResponse> {
  const { clientId, clientSecret, code, redirectUri } = params;

  if (!clientId || !clientSecret || !code || !redirectUri) {
    throw new AccountingAuthError(
      'sage-accounting',
      'Sage OAuth code değişimi yapılamadı: Eksik parametreler.',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code.trim(),
    redirect_uri: redirectUri.trim(),
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
  });

  let res: Response;
  try {
    res = await fetchFn(SAGE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
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
    const desc = errBody?.error_description || errBody?.error || `HTTP ${res.status}`;
    // Never leak client_secret or authorization code in error
    throw new AccountingAuthError(
      'sage-accounting',
      `Sage yetkilendirme kodu değişimi başarısız (${res.status}): ${desc}`,
    );
  }

  return (await res.json()) as SageOAuthTokenResponse;
}
