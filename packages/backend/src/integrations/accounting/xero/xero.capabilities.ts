import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

export const XERO_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.DOCUMENTATION_REQUIRED,
  findInvoiceByReference: CapabilityStatus.MOCK_ONLY,
  multiCompany: CapabilityStatus.MOCK_ONLY,
  refreshSemantics: {
    rotatesOnRefresh: true,
    previousTokenGraceMs: 1_800_000, // 30 minutes grace period on rotated refresh token
    inactivityLimitDays: 60, // 60 days inactivity expiry
    staleTokenUseIsDestructive: false,
  },
};
