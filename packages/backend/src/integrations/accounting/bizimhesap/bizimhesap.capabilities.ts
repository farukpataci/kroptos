import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

export const BIZIMHESAP_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.NOT_SUPPORTED,
  contactSync: CapabilityStatus.NOT_SUPPORTED,
  productMapping: CapabilityStatus.NOT_SUPPORTED,
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.NOT_SUPPORTED,
  findInvoiceByReference: CapabilityStatus.NOT_SUPPORTED,
  multiCompany: CapabilityStatus.SUPPORTED,
  eDocument: CapabilityStatus.NOT_SUPPORTED,
};
