import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { PARASUT_CAPABILITIES } from './parasut.capabilities';
import { PARASUT_CREDENTIAL_SCHEMA } from './parasut.credential-schema';
import { ParasutConnector } from './parasut.connector';

export const PARASUT_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'PARASUT',
  displayName: 'Paraşüt',
  country: 'TR',
  protocol: 'jsonapi',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: PARASUT_CREDENTIAL_SCHEMA,
  capabilities: PARASUT_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: ParasutConnector,
};

AccountingProviderRegistry.register(PARASUT_DESCRIPTOR);
