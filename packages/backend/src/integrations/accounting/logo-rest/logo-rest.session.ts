import { AccountingAuthError } from '../core/AccountingErrors';
import {
  LOGO_REST_DEFAULT_PORT,
  LOGO_REST_TOKEN_PATH,
  LogoRestTokenRequest,
  LogoRestTokenResponse,
} from './logo-rest.types';

/** docs/logo.agent.md §1.1 — doğrulanmış tek uç. Saf fonksiyon, ağ yok. */
export function buildLogoRestTokenRequest(
  credentials: Record<string, any>,
  firmNo: string,
): LogoRestTokenRequest {
  let base = String(credentials.baseUrl || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) base = `http://${base}`;
  if (!/:\d+$/.test(base)) base = `${base}:${LOGO_REST_DEFAULT_PORT}`;
  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
  return {
    url: `${base}${LOGO_REST_TOKEN_PATH}`,
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basic}` },
    body: {
      grant_type: 'password',
      username: String(credentials.username ?? ''),
      password: String(credentials.password ?? ''),
      firmno: firmNo,
    },
  };
}

type FetchToken = (req: LogoRestTokenRequest) => Promise<LogoRestTokenResponse>;

/**
 * Oturum anahtarı = firmno (§5.3). Firma 2'nin token'ı firma 3'e ASLA kullanılmaz.
 * expires_in doğrulanmadı; gelmezse 5 dk varsayılır.
 */
export class LogoRestSessionManager {
  private readonly tokens = new Map<string, { accessToken: string; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<string>>();

  constructor(
    private readonly credentials: Record<string, any>,
    private readonly fetchToken: FetchToken,
  ) {}

  async getToken(firmNo: string): Promise<string> {
    const cached = this.tokens.get(firmNo);
    if (cached && Date.now() < cached.expiresAt - 60_000) return cached.accessToken;

    const pending = this.inFlight.get(firmNo);
    if (pending) return pending;

    const p = (async () => {
      try {
        const res = await this.fetchToken(buildLogoRestTokenRequest(this.credentials, firmNo));
        if (!res?.access_token) throw new Error('access_token dönmedi');
        const ttlMs = (res.expires_in ?? 300) * 1000;
        this.tokens.set(firmNo, { accessToken: res.access_token, expiresAt: Date.now() + ttlMs });
        return res.access_token;
      } catch (err: any) {
        this.tokens.delete(firmNo);
        throw new AccountingAuthError('LOGO-REST', `Firma ${firmNo} için token alınamadı: ${err.message}`);
      } finally {
        this.inFlight.delete(firmNo);
      }
    })();
    this.inFlight.set(firmNo, p);
    return p;
  }

  clear(firmNo?: string): void {
    firmNo ? this.tokens.delete(firmNo) : this.tokens.clear();
  }
}
