import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { KOLAYBI_CAPABILITIES } from './kolaybi.capabilities';
import { KOLAYBI_CREDENTIAL_SCHEMA } from './kolaybi.credential-schema';
import { KolaybiConnector } from './kolaybi.connector';

export const KOLAYBI_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'KOLAYBI',
  displayName: "KolayBi'",
  country: 'TR',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: KOLAYBI_CREDENTIAL_SCHEMA,
  capabilities: KOLAYBI_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: KolaybiConnector,
};

AccountingProviderRegistry.register(KOLAYBI_DESCRIPTOR);
