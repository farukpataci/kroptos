import { IOdooTransport } from './odoo.transport';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import {
  OdooSchemaDiscovery,
  OdooSchemaField,
  OdooVersionInfo,
} from './odoo.types';

/**
 * Required fields per model for KroptOS integration (§5.2)
 */
export const ODOO_REQUIRED_MODEL_FIELDS: Record<string, string[]> = {
  'account.move': [
    'name',
    'ref',
    'state',
    'move_type',
    'partner_id',
    'invoice_line_ids',
    'amount_total',
  ],
  'account.move.line': ['name', 'quantity', 'price_unit'],
  'res.partner': ['name'],
};

/**
 * Odoo Schema Introspection & Discovery Manager (§5.2, §8.7, §8.8)
 */
export class OdooSchemaManager {
  /**
   * Introspect models via fields_get on the active transport
   */
  static async discoverSchema(
    transport: IOdooTransport,
    version: OdooVersionInfo,
    companyId?: number | string,
  ): Promise<OdooSchemaDiscovery> {
    const modelsToInspect = ['account.move', 'account.move.line', 'res.partner', 'product.product', 'account.payment'];
    const modelSchemas: Record<string, Record<string, OdooSchemaField>> = {};
    const missingFields: string[] = [];

    for (const model of modelsToInspect) {
      try {
        const fields = await transport.execute<Record<string, OdooSchemaField>>({
          model,
          method: 'fields_get',
          kwargs: {},
          companyId,
        });
        modelSchemas[model] = fields;

        // Verify required fields
        const required = ODOO_REQUIRED_MODEL_FIELDS[model] || [];
        for (const reqField of required) {
          if (!fields || !fields[reqField]) {
            missingFields.push(`${model}.${reqField}`);
          }
        }
      } catch (err: any) {
        if (
          err instanceof IntegrationNotVerifiedError ||
          err?.name === 'IntegrationNotVerifiedError'
        ) {
          throw err;
        }
        // If a model is missing entirely (e.g. account.payment in an uninstalled module)
        missingFields.push(`${model} (Model erişilemedi: ${err?.message || 'Bilinmiyor'})`);
      }
    }

    const isValid = missingFields.length === 0;

    return {
      version,
      transport: transport.kind,
      discoveredAt: new Date().toISOString(),
      models: modelSchemas as any,
      missingRequiredFields: missingFields,
      isValid,
    };
  }

  /**
   * Verify if a re-discovery is needed due to version upgrade (§5.2 item 5)
   */
  static shouldRediscover(
    existingDiscovery: OdooSchemaDiscovery | null | undefined,
    currentVersion: OdooVersionInfo,
  ): boolean {
    if (!existingDiscovery || !existingDiscovery.isValid) return true;
    return (
      existingDiscovery.version.majorVersion !== currentVersion.majorVersion ||
      existingDiscovery.version.server_version !== currentVersion.server_version
    );
  }
}
