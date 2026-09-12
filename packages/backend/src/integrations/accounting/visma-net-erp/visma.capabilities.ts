import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';
import { RefreshSemantics } from '../core/AccountingTokenSemantics';

/**
 * Visma Connect OAuth 2.0 Token Refresh Semantics (§4.1, §4.2):
 * - rotatesOnRefresh: false (Visma Connect refresh token standart ömre sahiptir).
 * - previousTokenGraceMs: 0.
 * - inactivityLimitDays: 30.
 * - staleTokenUseIsDestructive: false.
 */
export const VISMA_REFRESH_SEMANTICS: RefreshSemantics = {
  rotatesOnRefresh: false,
  previousTokenGraceMs: 0,
  inactivityLimitDays: 30,
  staleTokenUseIsDestructive: false,
};

export const VISMA_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.MOCK_ONLY,
  findInvoiceByReference: CapabilityStatus.MOCK_ONLY,
  multiCompany: CapabilityStatus.SUPPORTED,
  eDocument: CapabilityStatus.NOT_SUPPORTED,
  refreshSemantics: VISMA_REFRESH_SEMANTICS,
};
