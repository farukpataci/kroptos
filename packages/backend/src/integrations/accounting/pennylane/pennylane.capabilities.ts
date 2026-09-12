import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';
import { RefreshSemantics } from '../core/AccountingTokenSemantics';

/**
 * Pennylane API v2 Token Yenileme Semantiği (§2.3, §5.3)
 *
 * Pennylane API v2 Bearer token modeli:
 * - Token bazlı (API Key veya OAuth2 token)
 * - rotatesOnRefresh: false
 * - previousTokenGraceMs: 0
 * - inactivityLimitDays: 30
 * - staleTokenUseIsDestructive: false
 */
export const PENNYLANE_REFRESH_SEMANTICS: RefreshSemantics = {
  rotatesOnRefresh: false,
  previousTokenGraceMs: 0,
  inactivityLimitDays: 30,
  staleTokenUseIsDestructive: false,
};

export const PENNYLANE_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.DOCUMENTATION_REQUIRED, // §5.6: Tahsilat uçları tam doğrulanana kadar DOCUMENTATION_REQUIRED
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED, // §6: Factur-X / PDP içe aktarma bu turda KAPSAM DIŞI
  cancelInvoice: CapabilityStatus.MOCK_ONLY,
  findInvoiceByReference: CapabilityStatus.DOCUMENTATION_REQUIRED, // §5.5: Canlıda tam teyit edilene kadar DOCUMENTATION_REQUIRED
  multiCompany: CapabilityStatus.SUPPORTED, // Pennylane her şirket için bağımsız token/bütçe sunar (§5.3)
  eDocument: CapabilityStatus.NOT_SUPPORTED,
  refreshSemantics: PENNYLANE_REFRESH_SEMANTICS,
};
