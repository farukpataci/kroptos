import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { PENNYLANE_CAPABILITIES } from './pennylane.capabilities';
import { PENNYLANE_CREDENTIAL_SCHEMA } from './pennylane.credential-schema';
import { PennylaneConnector } from './pennylane.connector';

export const PENNYLANE_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'PENNYLANE',
  displayName: 'Pennylane',
  country: 'FR',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: PENNYLANE_CREDENTIAL_SCHEMA,
  capabilities: PENNYLANE_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: PennylaneConnector,
};

AccountingProviderRegistry.register(PENNYLANE_DESCRIPTOR);
