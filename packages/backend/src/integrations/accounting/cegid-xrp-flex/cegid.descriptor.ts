import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { CEGID_CAPABILITIES } from './cegid.capabilities';
import { CEGID_CREDENTIAL_SCHEMA } from './cegid.credential-schema';
import { CegidConnector } from './cegid.connector';

export const CEGID_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'CEGID-XRP-FLEX',
  displayName: 'Cegid XRP Flex',
  country: 'FR',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: CEGID_CREDENTIAL_SCHEMA,
  capabilities: CEGID_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: CegidConnector,
};

AccountingProviderRegistry.register(CEGID_DESCRIPTOR);
