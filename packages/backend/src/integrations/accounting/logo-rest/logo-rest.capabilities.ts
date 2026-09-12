import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

export const LOGO_REST_CAPABILITIES: AccountingCapabilities = {
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  // Stok ERP→KroptOS akışı bu çatının değil warehouse-settings/logo-stock'un işi (conformance #6).
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  // externalRef'in Logo'da hangi alana yazılacağı doğrulanmadı (§7.3.1) → iptal kapalı.
  cancelInvoice: CapabilityStatus.DOCUMENTATION_REQUIRED,
  findInvoiceByReference: CapabilityStatus.MOCK_ONLY,
  multiCompany: CapabilityStatus.SUPPORTED,
  eDocument: CapabilityStatus.NOT_SUPPORTED,
};
