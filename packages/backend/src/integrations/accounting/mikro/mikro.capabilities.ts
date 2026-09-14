import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * docs/mikro.agent.md §7.1 — başlangıç tablosu. BU TABLOYU ELLE SUPPORTED YAPMA; her satır
 * Faz D'de gerçek bir çağrıyla değişir ve lastVerifiedAt o zaman dolar.
 */
export const MIKRO_CAPABILITIES: AccountingCapabilities = {
  // --- Agent rotası yetenekleri (§7.1) ---
  connectionTest: CapabilityStatus.DOCUMENTATION_REQUIRED, // APILogin var, cevabı görülmedi
  companyList: CapabilityStatus.NOT_SUPPORTED, // firma listeleme endpoint'i yok
  warehouseList: CapabilityStatus.DOCUMENTATION_REQUIRED, // endpoint görülmedi → katalog adayı
  productSearch: CapabilityStatus.DOCUMENTATION_REQUIRED, // StokListesiV2 filtre adları doğrulanmadı
  productFetch: CapabilityStatus.DOCUMENTATION_REQUIRED,
  productCreate: CapabilityStatus.CONTRACT_REQUIRED, // ERP kartı açma ilk fazda kapalı
  stockSnapshot: CapabilityStatus.DOCUMENTATION_REQUIRED, // depo kırılımı dönüyor mu bilinmiyor
  stockDelta: CapabilityStatus.NOT_SUPPORTED, // değişim tarihi filtresi dokümante değil — sahte delta = eskiyen stok
  partnerFetch: CapabilityStatus.DOCUMENTATION_REQUIRED,
  partnerUpsert: CapabilityStatus.DOCUMENTATION_REQUIRED,
  receiptPush: CapabilityStatus.DOCUMENTATION_REQUIRED, // tahsilat karşılığı doğrulanmadı
  invoicePush: CapabilityStatus.DOCUMENTATION_REQUIRED,
  invoiceFindByRef: CapabilityStatus.DOCUMENTATION_REQUIRED, // fatura sorgulama endpoint'i yok — tek yol katalog
  invoiceCancel: CapabilityStatus.CONTRACT_REQUIRED, // K12: silme iptal değildir
  eDocument: CapabilityStatus.NOT_SUPPORTED, // kapsam kararı

  // --- Çekirdek (eski) anahtarlar — aynı gerçeğin eşlemesi ---
  salesInvoice: CapabilityStatus.DOCUMENTATION_REQUIRED, // = invoicePush
  payment: CapabilityStatus.DOCUMENTATION_REQUIRED, // = receiptPush
  contactSync: CapabilityStatus.DOCUMENTATION_REQUIRED, // = partnerUpsert
  productMapping: CapabilityStatus.DOCUMENTATION_REQUIRED, // = productFetch
  stockSync: CapabilityStatus.NOT_SUPPORTED, // ön muhasebe stok yazma değil; ERP→KroptOS okuma stockSnapshot'ta
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.CONTRACT_REQUIRED, // = invoiceCancel (K12)
  findInvoiceByReference: CapabilityStatus.DOCUMENTATION_REQUIRED, // = invoiceFindByRef
  multiCompany: CapabilityStatus.SUPPORTED, // FirmaKodu + CalismaYili her istekte — AccountingCompany satırı
};
