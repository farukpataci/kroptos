import { IOdooTransport } from './odoo.transport';
import { OdooCallParams, OdooTransportKind } from './odoo.types';
import { OdooAllowlistValidator } from './odoo.allowlist';

/**
 * Odoo >= 19 Modern JSON-2 REST Transport (§3.1, §3.2, §5.3)
 *
 * Endpoint: POST /json/2/<model>/<method>
 * Headers:
 *   Authorization: Bearer <apiKey>
 *   X-Odoo-Database: <database>
 *   Content-Type: application/json
 * Payload: named parameters + "context"
 */
export class OdooTransportJson2 implements IOdooTransport {
  readonly kind: OdooTransportKind = 'json2';

  constructor(
    public readonly baseUrl: string,
    public readonly database: string,
    public readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async execute<T>(params: OdooCallParams): Promise<T> {
    const { model, method, kwargs = {}, companyId } = params;

    // §5.1: Assert against security allowlist before doing any network dispatch
    OdooAllowlistValidator.assertAllowed(model, method);

    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, '');
    const url = `${cleanBaseUrl}/json/2/${model}/${method}`;

    // §5.3: Context handling for multi-company
    const context = {
      ...(kwargs.context || {}),
      ...(companyId ? { allowed_company_ids: [companyId], company_id: companyId } : {}),
    };

    const bodyPayload = {
      ...kwargs,
      context,
    };

    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'X-Odoo-Database': this.database,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as any;
      const err: any = new Error(
        errorBody.message || errorBody.error?.message || `Odoo JSON-2 HTTP ${res.status}`,
      );
      err.status = res.status;
      err.response = { status: res.status, data: errorBody };
      throw err;
    }

    const data = await res.json();
    return data as T;
  }
}
