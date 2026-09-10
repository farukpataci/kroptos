import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * Lexware Office Accounting Capabilities (§2, §4, §5.5, §5.7)
 *
 * CRITICAL TOKEN SEMANTICS (§4):
 * Lexware Office uses static API keys generated from the web portal.
 * There is NO OAuth, NO refresh token, NO expiry, and NO token rotation.
 * Therefore, refreshSemantics is explicitly undefined.
 * This serves as the second negative test for the core token store (twin to Odoo).
 *
 * CRITICAL PAYMENT SEMANTICS (§5.7):
 * The /v1/payments endpoint is strictly GET (read-only). Writing payments is NOT supported.
 * Therefore, payment capability is explicitly NOT_SUPPORTED.
 *
 * CRITICAL REFERENCE SEARCH SEMANTICS (§5.5):
 * Lexware generates voucher numbers internally and does not support filtering by
 * external KroptOS reference. Therefore, findInvoiceByReference is DOCUMENTATION_REQUIRED.
 */
export const LEXWARE_CAPABILITIES: AccountingCapabilities = {
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.NOT_SUPPORTED,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.MOCK_ONLY,
  findInvoiceByReference: CapabilityStatus.DOCUMENTATION_REQUIRED,
  multiCompany: CapabilityStatus.MOCK_ONLY,
  refreshSemantics: undefined,
};
