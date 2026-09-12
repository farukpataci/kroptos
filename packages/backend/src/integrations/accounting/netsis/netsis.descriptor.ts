import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { LOGO_REST_CAPABILITIES } from '../logo-rest/logo-rest.capabilities';
import { NETSIS_CREDENTIAL_SCHEMA } from './netsis.credential-schema';
import { NetsisConnector } from './netsis.connector';

export const NETSIS_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'NETSIS',
  displayName: 'Logo Netsis (NetOpenX)',
  country: 'TR',
  protocol: 'custom', // COM ve/veya NOX REST — sözleşmesi doğrulanmadı
  readiness: 'MOCK_READY',
  documentationStatus: 'DOCUMENTATION_REQUIRED', // §1.3: min. sürüm, endpoint'ler, login şeması doğrulanmadı
  credentialSchema: NETSIS_CREDENTIAL_SCHEMA,
  capabilities: LOGO_REST_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: NetsisConnector,
};

AccountingProviderRegistry.register(NETSIS_DESCRIPTOR);
