import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * Oracle NetSuite Accounting Capabilities (§4, §5.7, §6)
 *
 * CRITICAL TOKEN SEMANTICS (§4):
 * NetSuite M2M utilizes OAuth 2.0 Client Credentials with asymmetric JWT assertion.
 * There is NO refresh token, NO refresh URL, and NO token rotation.
 * An access token is fetched on demand via signed JWT and cached in memory (60 min).
 * Therefore, refreshSemantics is explicitly undefined.
 * This serves as the FOURTH negative test for the core token store (following Odoo, Lexware, sevDesk).
 * NetSuite must NEVER enter the AccountingTokenStore keep-alive/refresh loop.
 *
 * REFERENCE SEARCH SEMANTICS (§5.7):
 * NetSuite natively supports externalId addressing via `eid:<externalId>`.
 * Therefore, findInvoiceByReference is MOCK_ONLY.
 */
export const NETSUITE_CAPABILITIES: AccountingCapabilities = {
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.MOCK_ONLY,
  findInvoiceByReference: CapabilityStatus.MOCK_ONLY,
  multiCompany: CapabilityStatus.MOCK_ONLY, // Subsidiary support (§5.9)
  // §4: Refresh semantics explicitly undefined (no refresh token mechanism)
  refreshSemantics: undefined,
};
