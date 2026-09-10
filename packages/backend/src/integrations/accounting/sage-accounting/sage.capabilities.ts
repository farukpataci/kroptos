import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * Sage Business Cloud Accounting Capabilities
 * No capability is SUPPORTED until live production/sandbox verification.
 */
export const SAGE_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.DOCUMENTATION_REQUIRED, // §4.7 - Contact payment lifecycle unverified
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  stockSync: CapabilityStatus.NOT_SUPPORTED, // Universal rule: Accounting does not sync stock
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED, // Regional UK/EU product, no GİB/e-fatura
  cancelInvoice: CapabilityStatus.DOCUMENTATION_REQUIRED, // §4.7 - Void vs Credit note lifecycle unverified
  findInvoiceByReference: CapabilityStatus.DOCUMENTATION_REQUIRED, // §4.5 - search parameter is fuzzy/not strict filter
  multiCompany: CapabilityStatus.MOCK_ONLY,
  refreshSemantics: {
    rotatesOnRefresh: true,
    previousTokenGraceMs: 0,
    inactivityLimitDays: 31,
  },
};
