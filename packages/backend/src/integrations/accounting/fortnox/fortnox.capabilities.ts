import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * Fortnox Capabilities
 * No capability is SUPPORTED until live production/sandbox verification.
 * RefreshSemantics Profile 6:
 * - rotatesOnRefresh: true (Fortnox issues a new refresh token upon refresh)
 * - previousTokenGraceMs: 0 (Old token is invalidated instantly, zero grace)
 * - inactivityLimitDays: 45 (Refresh token expires after 45 days of inactivity)
 * - staleTokenUseIsDestructive: true (Using a stale refresh token permanently invalidates chain)
 */
export const FORTNOX_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.DOCUMENTATION_REQUIRED,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  stockSync: CapabilityStatus.NOT_SUPPORTED, // Universal rule: Accounting does not sync stock
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED, // Sweden regional, no Turkish e-fatura/GİB
  cancelInvoice: CapabilityStatus.DOCUMENTATION_REQUIRED, // Unbooked can be cancelled; booked requires credit note
  findInvoiceByReference: CapabilityStatus.DOCUMENTATION_REQUIRED, // §5.7 - unverified in sandbox/prod
  multiCompany: CapabilityStatus.MOCK_ONLY,
  refreshSemantics: {
    rotatesOnRefresh: true,
    previousTokenGraceMs: 0,
    inactivityLimitDays: 45,
    staleTokenUseIsDestructive: true,
  },
};
