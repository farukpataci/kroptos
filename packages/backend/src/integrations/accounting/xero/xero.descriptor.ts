import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { XERO_CAPABILITIES } from './xero.capabilities';
import { XeroConnector } from './xero.connector';
import { XERO_CREDENTIAL_SCHEMA } from './xero.credential-schema';

export const XERO_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'XERO',
  displayName: 'Xero',
  country: 'NZ',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'VERIFIED',
  credentialSchema: XERO_CREDENTIAL_SCHEMA,
  capabilities: XERO_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: '2026-09-10T18:00:00Z',
  sandboxVerifiedAt: null,
  connectorClass: XeroConnector,
};

// Auto-register into central provider registry
AccountingProviderRegistry.register(XERO_DESCRIPTOR);
