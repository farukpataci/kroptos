import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { FREEAGENT_CAPABILITIES } from './freeagent.capabilities';
import { FREEAGENT_CREDENTIAL_SCHEMA } from './freeagent.credential-schema';
import { FreeAgentConnector } from './freeagent.connector';

export const FREEAGENT_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'FREEAGENT',
  displayName: 'FreeAgent',
  country: 'GB',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: FREEAGENT_CREDENTIAL_SCHEMA,
  capabilities: FREEAGENT_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  sandboxVerifiedAt: null,
  connectorClass: FreeAgentConnector,
};

// Auto-register into central accounting provider registry
AccountingProviderRegistry.register(FREEAGENT_DESCRIPTOR);
