import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { MIKRO_CAPABILITIES } from './mikro.capabilities';
import { MIKRO_CREDENTIAL_SCHEMA } from './mikro.credential-schema';
import { MikroConnector } from './mikro.connector';
import { MIKRO_METHOD_VERSIONS } from './mikro.types';

export const MIKRO_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'MIKRO',
  displayName: 'Mikro ERP (v16/v17)',
  country: 'TR',
  protocol: 'rest',
  readiness: 'SCAFFOLDED', // Faz D'de gerçek çağrıyla değişir; lastVerifiedAt o zaman dolar
  documentationStatus: 'PARTIAL', // kurulum/kimlik/endpoint envanteri doğrulandı; zarf/alan adları değil (§3)
  credentialSchema: MIKRO_CREDENTIAL_SCHEMA,
  capabilities: MIKRO_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: MikroConnector,
  // --- Agent çatısı ---
  supportedRoutes: ['AGENT'], // K5/K10: Mikro internete açık değil; Agent localhost'a bağlanır
  methodVersions: MIKRO_METHOD_VERSIONS,
  vendorFamily: 'mikro',
  productScope: ['Mikro v16 (port 8084)', 'Mikro v17 (port 8094)'],
  requiresPeriod: true, // CalismaYili her istekte gövdededir (K4)
  periodPolicy: 'PERIOD_NUMBER', // D5 (docs/nebim.v3.agent.md §4, §6)
  requiresBranch: false,
  commercialPrerequisite: 'accounting.prerequisite.mikro.apiApplication', // API Başvuru Formu → lisans ataması
};

AccountingProviderRegistry.register(MIKRO_DESCRIPTOR);
