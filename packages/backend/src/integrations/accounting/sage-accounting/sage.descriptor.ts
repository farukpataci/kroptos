import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { SAGE_CAPABILITIES } from './sage.capabilities';
import { SageConnector } from './sage.connector';
import { SAGE_CREDENTIAL_SCHEMA } from './sage.credential-schema';

export const SAGE_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'SAGE-ACCOUNTING',
  displayName: 'Sage Business Cloud Accounting',
  country: 'GB',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: SAGE_CREDENTIAL_SCHEMA,
  capabilities: SAGE_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  sandboxVerifiedAt: null,
  connectorClass: SageConnector,
};

// Auto-register into central provider registry
AccountingProviderRegistry.register(SAGE_DESCRIPTOR);
