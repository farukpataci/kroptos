import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';
import { RefreshSemantics } from '../core/AccountingTokenSemantics';

/**
 * Cegid XRP Flex OAuth 2.0 Token Yenileme Semantiği (§6.3)
 *
 * Password / Token tabanlı kimlik akışında refresh token rotasyonu yoktur:
 * - rotatesOnRefresh: false
 * - previousTokenGraceMs: 0
 * - inactivityLimitDays: 30
 * - staleTokenUseIsDestructive: false
 */
export const CEGID_REFRESH_SEMANTICS: RefreshSemantics = {
  rotatesOnRefresh: false,
  previousTokenGraceMs: 0,
  inactivityLimitDays: 30,
  staleTokenUseIsDestructive: false,
};

export const CEGID_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.MOCK_ONLY,
  findInvoiceByReference: CapabilityStatus.DOCUMENTATION_REQUIRED,
  multiCompany: CapabilityStatus.SUPPORTED,
  eDocument: CapabilityStatus.NOT_SUPPORTED,
  refreshSemantics: CEGID_REFRESH_SEMANTICS,
};
