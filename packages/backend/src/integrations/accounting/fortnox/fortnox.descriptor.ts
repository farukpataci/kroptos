import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { FORTNOX_CAPABILITIES } from './fortnox.capabilities';
import { FORTNOX_CREDENTIAL_SCHEMA } from './fortnox.credential-schema';
import { FortnoxConnector } from './fortnox.connector';

export const FORTNOX_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'FORTNOX',
  displayName: 'Fortnox',
  country: 'SE',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: FORTNOX_CREDENTIAL_SCHEMA,
  capabilities: FORTNOX_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: FortnoxConnector,
};

AccountingProviderRegistry.register(FORTNOX_DESCRIPTOR);
