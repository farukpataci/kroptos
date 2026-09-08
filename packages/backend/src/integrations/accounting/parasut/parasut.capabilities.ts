import {
  AccountingCapabilities,
  CapabilityStatus,
} from '../core/AccountingTypes';

export const PARASUT_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  // Paraşüt is a front-office accounting service, not an ERP warehouse master.
  // Stock synchronization is strictly out of scope.
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  // Phase 1 does not officially transmit e-archive/e-invoice to GİB.
  // It only creates invoice records.
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.DOCUMENTATION_REQUIRED,
  findInvoiceByReference: CapabilityStatus.MOCK_ONLY,
};
