import { IOdooTransport } from './odoo.transport';
import { OdooCallParams, OdooTransportKind } from './odoo.types';
import { OdooAllowlistValidator } from './odoo.allowlist';

/**
 * Odoo < 19 Classic RPC Transport (§3.1, §3.2, §3.3)
 *
 * Endpoint: POST /jsonrpc (Standard JSON-RPC 2.0 object/execute_kw)
 *
 * Security: Uses API Key as password; username can be any login or empty string for API keys.
 * Error handling: Catches Odoo RPC error blocks returned inside HTTP 200 (BizimHesap lesson).
 */
export class OdooTransportRpc implements IOdooTransport {
  readonly kind: OdooTransportKind = 'rpc';

  constructor(
    public readonly baseUrl: string,
    public readonly database: string,
    public readonly apiKey: string,
    public readonly uid: number = 2, // Standard admin/service user ID, or resolved
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async execute<T>(params: OdooCallParams): Promise<T> {
    const { model, method, args = [], kwargs = {}, companyId } = params;

    // §5.1: Assert against security allowlist before doing any network dispatch
    OdooAllowlistValidator.assertAllowed(model, method);

    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, '');
    const url = `${cleanBaseUrl}/jsonrpc`;

    // §5.3: Context handling in keyword arguments
    const context = {
      ...(kwargs.context || {}),
      ...(companyId ? { allowed_company_ids: [companyId], company_id: companyId } : {}),
    };

    const finalKwargs = {
      ...kwargs,
      context,
    };

    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          this.database,
          this.uid,
          this.apiKey,
          model,
          method,
          args,
          finalKwargs,
        ],
      },
      id: Math.floor(Math.random() * 1000000),
    };

    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as any;
      const err: any = new Error(`Odoo RPC HTTP ${res.status}`);
      err.status = res.status;
      err.response = { status: res.status, data: errorBody };
      throw err;
    }

    const data: any = await res.json();

    // §3.2, §3.3: In classic RPC, Odoo often returns HTTP 200 with an "error" payload
    if (data?.error) {
      const odooError = data.error;
      const message =
        odooError.data?.message ||
        odooError.message ||
        'Odoo RPC çağrısı başarısız oldu.';
      const err: any = new Error(message);
      err.status = 200;
      err.response = { status: 200, data: odooError };
      throw err;
    }

    return data.result as T;
  }
}
