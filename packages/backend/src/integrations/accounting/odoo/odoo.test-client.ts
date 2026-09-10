import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { IOdooTransport } from './odoo.transport';
import { OdooCallParams, OdooTransportKind } from './odoo.types';

/**
 * Odoo Test Environment Client (§2, §6)
 *
 * MOCK_READY phase guard: Throws IntegrationNotVerifiedError.
 */
export class OdooTestClient implements IOdooTransport {
  readonly kind: OdooTransportKind = 'json2';

  constructor(public readonly baseUrl: string = '') {}

  async execute<T>(_params: OdooCallParams): Promise<T> {
    throw new IntegrationNotVerifiedError(
      'odoo',
      'Odoo TEST (Staging/Sandbox) ortamı henüz doğrulanmamıştır (MOCK_READY aşamasındayız). Canlı ağ çağrısı yapılamaz.',
    );
  }
}
