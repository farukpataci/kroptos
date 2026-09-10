import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * Dynamics 365 Business Central Online Capabilities
 * All live execution capabilities are guarded until live sandbox/production verification.
 */
export const BC_ONLINE_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.DOCUMENTATION_REQUIRED, // §4.7 - Standard v2.0 API has unverified payment posting lifecycle
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  stockSync: CapabilityStatus.NOT_SUPPORTED, // Universal rule: Accounting does not sync stock
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.MOCK_ONLY, // §4.4 - Draft (DELETE) vs Posted (Microsoft.NAV.cancel / makeCorrectiveCreditMemo)
  findInvoiceByReference: CapabilityStatus.MOCK_ONLY, // §4.3 - $filter=externalDocumentNumber eq '<ref>' in mock only until live verify
  multiCompany: CapabilityStatus.SUPPORTED,
};
