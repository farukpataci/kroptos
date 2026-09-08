import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { SAP_S4HANA_CLOUD_CAPABILITIES } from './sap-s4hana-cloud.capabilities';
import { SapS4HanaCloudConnector } from './sap-s4hana-cloud.connector';
import { SAP_S4HANA_CLOUD_CREDENTIAL_SCHEMA } from './sap-s4hana-cloud.credential-schema';

export const SAP_S4HANA_CLOUD_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'SAP_S4HANA_CLOUD',
  displayName: 'SAP S/4HANA Cloud (Public Edition)',
  country: 'DE',
  protocol: 'odata',
  readiness: 'MOCK_READY',
  documentationStatus: 'PARTIAL',
  credentialSchema: SAP_S4HANA_CLOUD_CREDENTIAL_SCHEMA,
  capabilities: SAP_S4HANA_CLOUD_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  sandboxVerifiedAt: null,
  connectorClass: SapS4HanaCloudConnector,
};

// Auto-register into central provider registry
AccountingProviderRegistry.register(SAP_S4HANA_CLOUD_DESCRIPTOR);
