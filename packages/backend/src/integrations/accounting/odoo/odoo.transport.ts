import { OdooCallParams, OdooTransportKind } from './odoo.types';

/**
 * Common Internal Transport Interface (§3.2, §3.3)
 *
 * Mappers, connector and flow layers DO NOT know which transport (JSON-2 vs RPC)
 * is active under the hood. All transport differences are isolated here.
 */
export interface IOdooTransport {
  readonly kind: OdooTransportKind;
  execute<T>(params: OdooCallParams): Promise<T>;
}
