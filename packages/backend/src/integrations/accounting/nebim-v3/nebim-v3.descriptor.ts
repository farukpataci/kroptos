import { AccountingProviderDescriptor } from '../core/AccountingTypes';
import { NEBIM_V3_CAPABILITIES } from './nebim-v3.capabilities';
import { NEBIM_V3_CREDENTIAL_SCHEMA } from './nebim-v3.credential-schema';
import { NEBIM_POSTING_DEFAULTS } from './nebim-v3.posting-defaults';
import { NebimV3Connector } from './nebim-v3.connector';

export const NEBIM_V3_DESCRIPTOR: AccountingProviderDescriptor = {
  id: 'NEBIM-V3',
  displayName: 'Nebim V3 ERP',
  country: 'TR',
  protocol: 'rest',
  readiness: 'SCAFFOLDED', // Faz D'de gerçek çağrıyla doğrulanır
  documentationStatus: 'DOCUMENTATION_REQUIRED',
  credentialSchema: NEBIM_V3_CREDENTIAL_SCHEMA,
  capabilities: NEBIM_V3_CAPABILITIES,
  supportsMock: true,
  supportsTest: false,
  supportsProduction: false,
  lastVerifiedAt: null,
  connectorClass: NebimV3Connector,
  // --- Agent rotası ve Nebim V3 çatı kuralları ---
  supportedRoutes: ['AGENT'], // K19: düz HTTP LAN'a açılmaz; Agent localhost'a bağlanır
  periodPolicy: 'ERP_ENFORCED', // D5 (docs/nebim.v3.agent.md §4, §7.1)
  postingDefaultSpec: NEBIM_POSTING_DEFAULTS, // D6 (kayıt parametreleri)
  vendorFamily: 'nebim',
  productScope: ['Nebim V3 Başlangıç', 'Nebim V3 Standart', 'Nebim V3 İleri', 'Nebim V3 Kurumsal'],
  licensePrerequisite: 'accounting.nebim.prerequisite.userLicense', // K14: lisans tüketimi uyarısı
  commercialPrerequisite: 'accounting.nebim.prerequisite.dealer', // Nebim bayisinden API bilgileri
};

import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
AccountingProviderRegistry.register(NEBIM_V3_DESCRIPTOR);

