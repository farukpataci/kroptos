import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * docs/nebim.v3.agent.md §7.2 — Nebim V3 başlangıç yetenek tablosu.
 * Bu değerleri elle SUPPORTED yapma; her biri Faz D'de gerçek çağrıyla teyit edilir.
 */
export const NEBIM_V3_CAPABILITIES: AccountingCapabilities = {
  // Çekirdek yetenekler
  salesInvoice: CapabilityStatus.DOCUMENTATION_REQUIRED,
  payment: CapabilityStatus.DOCUMENTATION_REQUIRED,
  contactSync: CapabilityStatus.DOCUMENTATION_REQUIRED,
  productMapping: CapabilityStatus.DOCUMENTATION_REQUIRED,
  stockSync: CapabilityStatus.DOCUMENTATION_REQUIRED,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED, // Kapsam dışı — §7.2
  cancelInvoice: CapabilityStatus.DOCUMENTATION_REQUIRED,
  findInvoiceByReference: CapabilityStatus.DOCUMENTATION_REQUIRED,
  multiCompany: CapabilityStatus.DOCUMENTATION_REQUIRED,
  eDocument: CapabilityStatus.NOT_SUPPORTED,

  // Agent rotası yetenekleri (supportedRoutes bildiren sağlayıcıda hepsi zorunlu)
  connectionTest: CapabilityStatus.DOCUMENTATION_REQUIRED, // Connect ikincil kaynaktan biliniyor, cevabı doğrulanmadı
  companyList: CapabilityStatus.DOCUMENTATION_REQUIRED,
  warehouseList: CapabilityStatus.DOCUMENTATION_REQUIRED,
  productSearch: CapabilityStatus.DOCUMENTATION_REQUIRED,
  productFetch: CapabilityStatus.DOCUMENTATION_REQUIRED,
  productCreate: CapabilityStatus.CONTRACT_REQUIRED, // ERP kartı açma ilk fazda kapalı
  stockSnapshot: CapabilityStatus.DOCUMENTATION_REQUIRED,
  stockDelta: CapabilityStatus.DOCUMENTATION_REQUIRED, // NOT_SUPPORTED yapma: Nebim'de değişim damgası olabilir (§7.2)
  partnerFetch: CapabilityStatus.DOCUMENTATION_REQUIRED,
  partnerUpsert: CapabilityStatus.DOCUMENTATION_REQUIRED,
  receiptPush: CapabilityStatus.DOCUMENTATION_REQUIRED,
  invoicePush: CapabilityStatus.DOCUMENTATION_REQUIRED,
  invoiceFindByRef: CapabilityStatus.DOCUMENTATION_REQUIRED, // Dış referans alanı doğrulanacak (§12/4)
  invoiceCancel: CapabilityStatus.DOCUMENTATION_REQUIRED, // İptal mi silme mi doğrulanacak
};
