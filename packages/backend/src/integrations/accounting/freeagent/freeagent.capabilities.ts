import { AccountingCapabilities, CapabilityStatus } from '../core/AccountingTypes';

/**
 * FreeAgent Accounting Capabilities (§1, §3, §4, §5.6, §5.9)
 *
 * REFRESH SEMANTICS DÖRDÜNCÜ PROFİL (§4):
 * - rotatesOnRefresh: true (Yenilemede yeni access VE yeni refresh token döner)
 * - previousTokenGraceMs: 0 (Eski token için dokümante edilmiş tolerans penceresi yoktur -> 0 varsayılır)
 * - inactivityLimitDays: null (Pratikte süresiz / ~20 yıl)
 * - staleTokenUseIsDestructive: false (Aksi kanıtlanana kadar yıkıcı değil)
 *
 * MODEL DEĞİŞMİYOR: "15 yenileme/dakika" bir semantik değil hız limitidir,
 * AccountingRateLimiter'a aittir.
 *
 * REFERANSLA ARAMA SEMANTİĞİ (§5.9):
 * FreeAgent API GET /invoices listelemesinde harici po_reference filtresi desteklenmez.
 * Bu nedenle findInvoiceByReference DOCUMENTATION_REQUIRED olarak işaretlenir;
 * otomatik claim çözümü ve timeout retry kapalı tutulur.
 */
export const FREEAGENT_CAPABILITIES: AccountingCapabilities = {
  stockSync: CapabilityStatus.NOT_SUPPORTED,
  salesInvoice: CapabilityStatus.MOCK_ONLY,
  payment: CapabilityStatus.MOCK_ONLY,
  contactSync: CapabilityStatus.MOCK_ONLY,
  productMapping: CapabilityStatus.MOCK_ONLY,
  eInvoiceOfficialSend: CapabilityStatus.NOT_SUPPORTED,
  cancelInvoice: CapabilityStatus.MOCK_ONLY,
  findInvoiceByReference: CapabilityStatus.DOCUMENTATION_REQUIRED,
  multiCompany: CapabilityStatus.MOCK_ONLY,
  refreshSemantics: {
    rotatesOnRefresh: true,
    previousTokenGraceMs: 0,
    inactivityLimitDays: null,
    staleTokenUseIsDestructive: false,
  },
};
