import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { VISMA_CAPABILITIES } from './visma.capabilities';
import { VISMA_CREDENTIAL_SCHEMA } from './visma.credential-schema';
import { VismaNetErpConnector } from './visma.connector';

export const VISMA_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'VISMA-NET-ERP',
  displayName: 'Visma.net ERP',
  country: 'NO',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: VISMA_CREDENTIAL_SCHEMA,
  capabilities: VISMA_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: VismaNetErpConnector,
};

AccountingProviderRegistry.register(VISMA_DESCRIPTOR);
