import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { FATTURE_IN_CLOUD_CAPABILITIES } from './fic.capabilities';
import { FATTURE_IN_CLOUD_CREDENTIAL_SCHEMA } from './fic.credential-schema';
import { FattureInCloudConnector } from './fic.connector';

export const FATTURE_IN_CLOUD_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'FATTURE-IN-CLOUD',
  displayName: 'Fatture in Cloud (TeamSystem)',
  country: 'IT',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: FATTURE_IN_CLOUD_CREDENTIAL_SCHEMA,
  capabilities: FATTURE_IN_CLOUD_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: FattureInCloudConnector,
};

AccountingProviderRegistry.register(FATTURE_IN_CLOUD_DESCRIPTOR);
