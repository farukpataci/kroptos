import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { ODOO_CAPABILITIES } from './odoo.capabilities';
import { OdooConnector } from './odoo.connector';
import { ODOO_CREDENTIAL_SCHEMA } from './odoo.credential-schema';

export const ODOO_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'ODOO',
  displayName: 'Odoo (ERP & Accounting)',
  country: 'BE', // Odoo S.A. Belgium / International standard
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: ODOO_CREDENTIAL_SCHEMA,
  capabilities: ODOO_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  sandboxVerifiedAt: null,
  connectorClass: OdooConnector,
};

// Auto-register into central provider registry
AccountingProviderRegistry.register(ODOO_DESCRIPTOR);
