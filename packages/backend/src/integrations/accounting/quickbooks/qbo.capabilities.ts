import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

export const QBO_CAPABILITIES: AccountingCapabilities = {
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.MOCK_ONLY,
  findInvoiceByReference: CapabilityStatus.MOCK_ONLY,
  multiCompany: CapabilityStatus.MOCK_ONLY,
  refreshSemantics: {
    rotatesOnRefresh: true, // QBO rotates refresh token ~24h periodically
    previousTokenGraceMs: 0, // No grace tolerance on rotated token
    inactivityLimitDays: 100, // Intuit official 100-day refresh token validity
    staleTokenUseIsDestructive: true, // §2.2 & §4.1: Retrying with stale token permanently revokes authorization chain
  },
};
