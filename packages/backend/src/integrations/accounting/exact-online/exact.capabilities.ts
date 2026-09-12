import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';
import { RefreshSemantics } from '../core/AccountingTokenSemantics';

/**
 * Exact Online OAuth 2.0 Token Refresh Semantics (§3.5, §4, §5.4):
 * - rotatesOnRefresh: true (Her yenilemede yeni bir refresh_token verilir).
 * - previousTokenGraceMs: 0 (Eski refresh token anında ölür; tolerans yoktur).
 * - inactivityLimitDays: 30 (30 gün hareketsizlik sonrası refresh token geçersiz kalır).
 * - staleTokenUseIsDestructive: false (Hata döner ancak yıkıcı değildir).
 * - earliestRefreshAfterMs: 570_000 (Token 570 saniyeden (9.5 dk) erken yenilenemez; çok erken yenileme 400 Bad Request verir).
 */
export const EXACT_REFRESH_SEMANTICS: RefreshSemantics = {
  rotatesOnRefresh: true,
  previousTokenGraceMs: 0,
  inactivityLimitDays: 30,
  staleTokenUseIsDestructive: false,
  earliestRefreshAfterMs: 570_000,
};

export const EXACT_CAPABILITIES: AccountingCapabilities = {
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
  refreshSemantics: EXACT_REFRESH_SEMANTICS,
};
