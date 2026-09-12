import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { LOGO_REST_CAPABILITIES } from './logo-rest.capabilities';
import { LOGO_REST_CREDENTIAL_SCHEMA } from './logo-rest.credential-schema';
import { LogoRestConnector } from './logo-rest.connector';

export const LOGO_REST_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'LOGO-REST',
  displayName: 'Logo Tiger REST Servis',
  country: 'TR',
  protocol: 'rest',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL', // yalnızca token ucu doğrulandı (docs/logo.agent.md §1.1)
  credentialSchema: LOGO_REST_CREDENTIAL_SCHEMA,
  capabilities: LOGO_REST_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: LogoRestConnector,
};

AccountingProviderRegistry.register(LOGO_REST_DESCRIPTOR);
