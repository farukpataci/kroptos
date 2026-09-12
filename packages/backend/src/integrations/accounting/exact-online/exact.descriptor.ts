import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { EXACT_CAPABILITIES } from './exact.capabilities';
import { EXACT_CREDENTIAL_SCHEMA } from './exact.credential-schema';
import { ExactOnlineConnector } from './exact.connector';

export const EXACT_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'EXACT-ONLINE',
  displayName: 'Exact Online',
  country: 'NL',
  protocol: 'odata',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: EXACT_CREDENTIAL_SCHEMA,
  capabilities: EXACT_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: ExactOnlineConnector,
};

AccountingProviderRegistry.register(EXACT_DESCRIPTOR);
