import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { LOGO_REST_CAPABILITIES } from '../logo-rest/logo-rest.capabilities';
import { LOGO_OBJECTS_CREDENTIAL_SCHEMA } from './logo-objects.credential-schema';
import { LogoObjectsConnector } from './logo-objects.connector';

export const LOGO_OBJECTS_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'LOGO-OBJECTS',
  displayName: 'Logo GO3 (Logo Objects)',
  country: 'TR',
  protocol: 'custom', // COM — Agent üzerinden; HTTP değil
  readiness: 'MOCK_READY',
  documentationStatus: 'DOCUMENTATION_REQUIRED', // resmî açık geliştirici dokümanı yok (§1.2)
  credentialSchema: LOGO_OBJECTS_CREDENTIAL_SCHEMA,
  capabilities: LOGO_REST_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: LogoObjectsConnector,
};

AccountingProviderRegistry.register(LOGO_OBJECTS_DESCRIPTOR);
