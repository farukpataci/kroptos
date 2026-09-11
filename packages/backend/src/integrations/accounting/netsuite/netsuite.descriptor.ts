import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { NETSUITE_CAPABILITIES } from './netsuite.capabilities';
import { NETSUITE_CREDENTIAL_SCHEMA } from './netsuite.credential-schema';
import { NetSuiteConnector } from './netsuite.connector';

export const NETSUITE_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'NETSUITE',
  displayName: 'Oracle NetSuite',
  country: 'US',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: NETSUITE_CREDENTIAL_SCHEMA,
  capabilities: NETSUITE_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  sandboxVerifiedAt: null,
  connectorClass: NetSuiteConnector,
};

// Auto-register into central accounting provider registry
AccountingProviderRegistry.register(NETSUITE_DESCRIPTOR);
