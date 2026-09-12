import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { SEVDESK_CAPABILITIES } from './sevdesk.capabilities';
import { SEVDESK_CREDENTIAL_SCHEMA } from './sevdesk.credential-schema';
import { SevdeskConnector } from './sevdesk.connector';

export const SEVDESK_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'SEVDESK',
  displayName: 'sevDesk',
  country: 'DE',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: SEVDESK_CREDENTIAL_SCHEMA,
  capabilities: SEVDESK_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  sandboxVerifiedAt: null,
  connectorClass: SevdeskConnector,
};

// Auto-register into central accounting provider registry
AccountingProviderRegistry.register(SEVDESK_DESCRIPTOR);
