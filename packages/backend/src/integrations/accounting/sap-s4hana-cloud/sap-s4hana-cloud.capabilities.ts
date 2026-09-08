import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

export const SAP_S4HANA_CLOUD_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.NOT_SUPPORTED,
  payment: CapabilityStatus.NOT_SUPPORTED,
  contactSync: CapabilityStatus.NOT_SUPPORTED, // Phase 1: Read-only; write is strictly NOT_SUPPORTED
  productMapping: CapabilityStatus.NOT_SUPPORTED,
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.NOT_SUPPORTED,
  findInvoiceByReference: CapabilityStatus.NOT_SUPPORTED,
  multiCompany: CapabilityStatus.SUPPORTED,
};
