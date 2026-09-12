import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * Fatture in Cloud (TeamSystem) Accounting Capabilities
 *
 * CRITICAL LEGAL CONSTRAINTS (§2.1, §5.1):
 * 1. eInvoiceOfficialSend: STRICTLY NOT_SUPPORTED in Phase 1.
 *    SdI transmission is irreversible. Dry-run validation is supported
 *    via fic.einvoice.ts without sending.
 * 2. cancelInvoice: NOT_SUPPORTED. In Italian e-invoicing law, issued documents
 *    cannot simply be voided/deleted; credit notes must be issued.
 * 3. findInvoiceByReference: DOCUMENTATION_REQUIRED (§5.7). External transaction
 *    reference uniqueness indexing is not verified. Automatic timeout retry disabled.
 * 4. stockSync: NOT_SUPPORTED (universal KroptOS accounting rule).
 * 5. refreshSemantics: OAuth2 refresh token rotates on each exchange and is valid for 1 year.
 */
export const FATTURE_IN_CLOUD_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.NOT_SUPPORTED,
  findInvoiceByReference: CapabilityStatus.DOCUMENTATION_REQUIRED,
  multiCompany: CapabilityStatus.MOCK_ONLY,
  refreshSemantics: {
    rotatesOnRefresh: true,
    previousTokenGraceMs: 0,
    inactivityLimitDays: 365,
    staleTokenUseIsDestructive: true,
  },
};
