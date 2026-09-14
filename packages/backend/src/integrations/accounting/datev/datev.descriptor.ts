import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { DATEV_CAPABILITIES } from './datev.capabilities';
import { DATEV_CREDENTIAL_SCHEMA } from './datev.credential-schema';
import { DatevConnector } from './datev.connector';

export const DATEV_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'DATEV',
  displayName: 'DATEV (EXTF Buchungsstapel)',
  country: 'DE',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'VERIFIED',
  credentialSchema: DATEV_CREDENTIAL_SCHEMA,
  capabilities: DATEV_CAPABILITIES,
  supportsMock: true,
  supportsTest: true,
  supportsProduction: true,
  isOffline: true, // EXTF dosya üretimi — ağ isteği yok; registry doğrulama kuralından muaf
  lastVerifiedAt: null,
  sandboxVerifiedAt: null,
  connectorClass: DatevConnector,
};

// Auto-register into central accounting provider registry
AccountingProviderRegistry.register(DATEV_DESCRIPTOR);
