import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * sevDesk Accounting Capabilities (§1, §3, §5.6, §5.8)
 *
 * CRITICAL TOKEN SEMANTICS (§3):
 * sevDesk uses static, indefinite API tokens associated with a specific user.
 * There is NO OAuth, NO refresh token, NO expiry, and NO token rotation.
 * Therefore, refreshSemantics is explicitly undefined.
 * This serves as the third negative test for the core token store (twin to Odoo and Lexware Office).
 *
 * CRITICAL REFERENCE SEARCH SEMANTICS (§5.6):
 * sevDesk does not support direct query filtering by external order reference.
 * Therefore, findInvoiceByReference is DOCUMENTATION_REQUIRED.
 * Automatic claim resolution and timeout retry are kept disabled.
 */
export const SEVDESK_CAPABILITIES: AccountingCapabilities = {
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.MOCK_ONLY,
  findInvoiceByReference: CapabilityStatus.DOCUMENTATION_REQUIRED,
  multiCompany: CapabilityStatus.MOCK_ONLY,
  refreshSemantics: undefined,
};
