import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { LEXWARE_CAPABILITIES } from './lexware.capabilities';
import { LEXWARE_CREDENTIAL_SCHEMA } from './lexware.credential-schema';
import { LexwareConnector } from './lexware.connector';

export const LEXWARE_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'LEXWARE-OFFICE',
  displayName: 'Lexware Office',
  country: 'DE',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: LEXWARE_CREDENTIAL_SCHEMA,
  capabilities: LEXWARE_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  sandboxVerifiedAt: null,
  connectorClass: LexwareConnector,
};

// Auto-register into central accounting provider registry
AccountingProviderRegistry.register(LEXWARE_DESCRIPTOR);
