import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { BIZIMHESAP_CAPABILITIES } from './bizimhesap.capabilities';
import { BIZIMHESAP_CREDENTIAL_SCHEMA } from './bizimhesap.credential-schema';
import { BizimhesapConnector } from './bizimhesap.connector';

export const BIZIMHESAP_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'BIZIMHESAP',
  displayName: 'BizimHesap',
  country: 'TR',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: BIZIMHESAP_CREDENTIAL_SCHEMA,
  capabilities: BIZIMHESAP_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: BizimhesapConnector,
};

AccountingProviderRegistry.register(BIZIMHESAP_DESCRIPTOR);
