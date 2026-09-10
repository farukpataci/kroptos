import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { QBO_CAPABILITIES } from './qbo.capabilities';
import { QuickBooksConnector } from './qbo.connector';
import { QBO_CREDENTIAL_SCHEMA } from './qbo.credential-schema';

export const QUICKBOOKS_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'QUICKBOOKS',
  displayName: 'QuickBooks Online',
  country: 'US',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: QBO_CREDENTIAL_SCHEMA,
  capabilities: QBO_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  sandboxVerifiedAt: null,
  connectorClass: QuickBooksConnector,
};

// Auto-register into central provider registry
AccountingProviderRegistry.register(QUICKBOOKS_DESCRIPTOR);
