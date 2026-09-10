import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { BC_ONLINE_CAPABILITIES } from './bc.capabilities';
import { BusinessCentralConnector } from './bc.connector';
import { BC_ONLINE_CREDENTIAL_SCHEMA } from './bc.credential-schema';

export const BC_ONLINE_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'MS_DYNAMICS_BC_ONLINE',
  displayName: 'Microsoft Dynamics 365 Business Central Online',
  country: 'US',
  protocol: 'odata',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: BC_ONLINE_CREDENTIAL_SCHEMA,
  capabilities: BC_ONLINE_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  sandboxVerifiedAt: null,
  connectorClass: BusinessCentralConnector,
};

// Auto-register into central provider registry
AccountingProviderRegistry.register(BC_ONLINE_DESCRIPTOR);
