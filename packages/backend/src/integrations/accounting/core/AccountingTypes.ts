export enum CapabilityStatus {
  SUPPORTED = 'SUPPORTED',
  MOCK_ONLY = 'MOCK_ONLY',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  DOCUMENTATION_REQUIRED = 'DOCUMENTATION_REQUIRED',
  CONTRACT_REQUIRED = 'CONTRACT_REQUIRED', // ticari/sözleşmesel karar gerekir (örn. silme ≠ iptal, K12)
  UNKNOWN = 'UNKNOWN',
}

export type AccountingEnvironment = 'MOCK' | 'TEST' | 'PRODUCTION';
export type AccountingReadiness = 'NOT_STARTED' | 'SCAFFOLDED' | 'MOCK_READY' | 'TEST_READY' | 'PRODUCTION_READY';
export type AccountingRoute = 'DIRECT' | 'AGENT';

export type AccountingDocumentType =
  | 'sales_invoice'
  | 'payment'
  | 'purchase_invoice'
  | 'e_archive'
  | 'e_invoice';

export type AccountingDocumentStatus = 'pending' | 'created' | 'failed' | 'cancelled';

export interface CredentialFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number' | 'select';
  required: boolean;
  secret?: boolean;
  description?: string;
  defaultValue?: string | number;
  /** Varsayılan SERVER_ENCRYPTED. AGENT_LOCAL alanlar sunucuda HİÇBİR KOŞULDA persist edilmez (K2). */
  storage?: 'SERVER_ENCRYPTED' | 'AGENT_LOCAL';
  /** Formda GÖSTERİLMEZ; Agent yerelde türetir (örn. Mikro Sifre = MD5(tarih + şifre)). */
  derived?: { from: string[]; strategy: string };
}

export interface AccountingProviderSchema {
  provider: string;
  name: string;
  fields: CredentialFieldDefinition[];
}

export interface AccountingProviderDescriptor {
  id: string;
  displayName: string;
  country: string;
  protocol: 'rest' | 'jsonapi' | 'soap' | 'odata' | 'custom';
  readiness: AccountingReadiness;
  documentationStatus: 'VERIFIED' | 'PARTIAL' | 'DOCUMENTATION_REQUIRED';
  credentialSchema: AccountingProviderSchema;
  capabilities: AccountingCapabilities;
  supportsMock: boolean;
  supportsTest: boolean;
  supportsProduction: boolean;
  lastVerifiedAt: string | null;
  sandboxVerifiedAt?: string | null;
  connectorClass: any;
  // --- Agent çatısı (docs/mikro.agent.md §6) — hepsi isteğe bağlı, eski sağlayıcılar etkilenmez ---
  /** Rota bağlantı kaydının özelliğidir; sağlayıcı yalnızca hangilerini taşıyabildiğini bildirir (K5). */
  supportedRoutes?: AccountingRoute[];
  /** Ağ isteği hiç yapmayan sağlayıcı (örn. DATEV dosya dışa aktarımı) — doğrulama kuralından muaf. */
  isOffline?: boolean;
  /** Metot sürümleri buradan okunur; "en yenisini kullan" mantığı YOK. */
  methodVersions?: Record<string, string>;
  vendorFamily?: string;
  productScope?: string[];
  requiresPeriod?: boolean;
  /** D5 (docs/nebim.v3.agent.md §4): dönem bir bayrak değil politikadır. */
  periodPolicy?: 'PERIOD_NUMBER' | 'DATE_RANGE' | 'ERP_ENFORCED';
  requiresBranch?: boolean;
  /** D6 (docs/nebim.v3.agent.md §4): yazma işlerinin ön koşulu olan kayıt parametreleri şeması. */
  postingDefaultSpec?: readonly PostingFieldSpec[];
  /** i18n anahtarı — panelde bağlantı kurulmadan ÖNCE gösterilir */
  commercialPrerequisite?: string;
  licensePrerequisite?: string;
}

export interface PostingFieldSpec {
  key: string;
  label?: string;
  required: boolean;
  appliesTo: readonly ('INVOICE' | 'RECEIPT' | 'ORDER' | 'STOCK')[];
}

/** Firma ekseni — SessionKey'in parçası (K4). */
export interface CompanyKey {
  companyNo: string;
  periodNo?: string | null;
  branchCode?: string | null;
}

/**
 * Connector'a verilen bağlam — KİMLİK TAŞIMAZ ve taşıyamaz (K1).
 * Backend ERP şifresini görmediği için taşıyamaz; transport işi rotaya göre yürütür.
 */
export interface AccountingContext {
  integrationId: string;
  tenant: { agencyId: string; clientId?: string | null };
  companyKey: CompanyKey;
  environment: AccountingEnvironment;
  transport: import('./transport/AccountingTransport').AccountingTransport;
  isTestMode: boolean;
}

export interface AccountingCapabilities {
  salesInvoice: CapabilityStatus;
  payment: CapabilityStatus;
  contactSync: CapabilityStatus;
  productMapping: CapabilityStatus;
  stockSync: CapabilityStatus; // Paraşüt & KolayBi: strictly NOT_SUPPORTED
  eInvoiceOfficialSend: CapabilityStatus; // strictly NOT_SUPPORTED in Phase 1
  cancelInvoice: CapabilityStatus;
  findInvoiceByReference: CapabilityStatus;
  multiCompany?: CapabilityStatus;
  eDocument?: CapabilityStatus;
  refreshSemantics?: import('./AccountingTokenSemantics').RefreshSemantics;
  // --- Agent rotası yetenekleri (docs/mikro.agent.md §6.1). supportedRoutes bildiren sağlayıcıda HEPSİ zorunlu. ---
  connectionTest?: CapabilityStatus;
  companyList?: CapabilityStatus;
  warehouseList?: CapabilityStatus;
  productSearch?: CapabilityStatus;
  productFetch?: CapabilityStatus;
  productCreate?: CapabilityStatus;
  stockSnapshot?: CapabilityStatus;
  stockDelta?: CapabilityStatus;
  partnerFetch?: CapabilityStatus;
  partnerUpsert?: CapabilityStatus;
  receiptPush?: CapabilityStatus;
  invoicePush?: CapabilityStatus;
  invoiceFindByRef?: CapabilityStatus;
  invoiceCancel?: CapabilityStatus;
}

export const CORE_CAPABILITY_KEYS = [
  'salesInvoice', 'payment', 'contactSync', 'productMapping', 'stockSync',
  'eInvoiceOfficialSend', 'cancelInvoice', 'findInvoiceByReference',
] as const;

export const AGENT_ROUTE_CAPABILITY_KEYS = [
  'connectionTest', 'companyList', 'warehouseList', 'productSearch', 'productFetch', 'productCreate',
  'stockSnapshot', 'stockDelta', 'partnerFetch', 'partnerUpsert', 'receiptPush', 'invoicePush',
  'invoiceFindByRef', 'invoiceCancel', 'eDocument',
] as const;

export type AgentRouteCapabilityKey = (typeof AGENT_ROUTE_CAPABILITY_KEYS)[number];

export interface AccountingInvoiceItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number; // e.g. 20, 10, 1, 0
  vatAmount?: number;
  discountAmount?: number;
  totalAmount: number;
}

export interface AccountingInvoiceContact {
  id?: string;
  name: string;
  taxNumber?: string;
  taxOffice?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  district?: string;
  isCompany?: boolean;
}

export interface AccountingInvoiceRequest {
  companyId: string;
  referenceCode: string;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  currency: string;
  contact: AccountingInvoiceContact;
  items: AccountingInvoiceItem[];
  subtotal: number;
  vatTotal: number;
  discountTotal?: number;
  grandTotal: number;
  notes?: string;
}

export interface AccountingInvoiceResult {
  externalId: string;
  externalNumber?: string;
  rawResponse?: Record<string, any>;
}

export interface AccountingPaymentRequest {
  companyId: string;
  invoiceExternalId: string;
  referenceCode: string;
  amount: number;
  currency: string;
  paymentDate: string; // YYYY-MM-DD
  paymentMethod?: string;
  accountId?: string;
  notes?: string;
}

export interface AccountingPaymentResult {
  externalId: string;
  rawResponse?: Record<string, any>;
}

export interface AccountingContactRequest {
  companyId: string;
  kroptosKey: string;
  name: string;
  taxNumber?: string;
  taxOffice?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  district?: string;
  isCompany?: boolean;
}

export interface AccountingContactResult {
  externalId: string;
  rawResponse?: Record<string, any>;
}

export interface AccountingProductRequest {
  companyId: string;
  sku: string;
  name: string;
  code?: string;
  vatRate?: number;
  currency?: string;
  unitPrice?: number;
}

export interface AccountingProductResult {
  externalId: string;
  code?: string;
  rawResponse?: Record<string, any>;
}

export interface AccountingTestConnectionResult {
  success: boolean;
  message: string;
  companyName?: string;
  companyId?: string;
  environment: AccountingEnvironment;
  /** K3: mock cevap gerçek gibi gösterilmez */
  isMock?: boolean;
  durationMs?: number;
}
