import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * Odoo Accounting Capabilities (§5.7, §6)
 *
 * CRITICAL TOKEN SEMANTICS (§5.7):
 * Odoo uses static API Keys. There is NO OAuth, NO refresh token, NO expiry.
 * Therefore, refreshSemantics is undefined.
 * This serves as a negative test for the core token store: keep-alive MUST NOT run for Odoo.
 */
export const ODOO_CAPABILITIES: AccountingCapabilities = {
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.MOCK_ONLY,
  findInvoiceByReference: CapabilityStatus.MOCK_ONLY,
  multiCompany: CapabilityStatus.MOCK_ONLY,
  // §5.7: Refresh semantics explicitly absent (undefined)
  refreshSemantics: undefined,
};
