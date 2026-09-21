export type ImportMode = 'CREATE_ONLY' | 'UPDATE_ONLY' | 'UPSERT';
export type MatchKey = 'orderNumber' | 'marketplaceOrderNumber' | 'publicId';

export type ImportJobStatus =
  | 'UPLOADED'
  | 'MAPPING'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'CANCELLED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK';

export interface FileDetectionResult {
  format: 'CSV' | 'XLSX';
  encoding: string;
  delimiter: string;
  headerRow: number;
  sheetNames?: string[];
  headers: string[];
  sampleRows: string[][];
  totalEstimatedRows: number;
}

export interface AutoMappingResult {
  columnMap: Record<string, string>;
  confidence: Record<string, number>;
  unmappedHeaders: string[];
}

export interface OrderImportJob {
  id: string;
  agencyId: string;
  storeId: string;
  clientId?: string;
  requestedById: string;
  fileKey: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  format: string;
  mode: ImportMode;
  matchKey: MatchKey;
  columnMap: Record<string, string>;
  valueMaps: Record<string, Record<string, string>>;
  options: {
    encoding?: string;
    delimiter?: string;
    headerRow?: number;
    sheetName?: string;
    decimalSeparator?: ',' | '.' | 'auto';
    dayFirst?: boolean;
    timezone?: string;
    suppressStock?: boolean;
    suppressNotifications?: boolean;
    suppressAutomation?: boolean;
    suppressMarketplace?: boolean;
    allOrNothing?: boolean;
    allowNonCatalogProducts?: boolean;
  };
  status: ImportJobStatus;
  totalRows: number;
  totalOrders: number;
  validOrders: number;
  invalidOrders: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  progress: number;
  errorReportKey?: string;
  startedAt?: string;
  completedAt?: string;
  rollbackDeadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderImportRowResult {
  id: string;
  jobId: string;
  groupKey: string;
  rowNumbers: number[];
  action: 'CREATE' | 'UPDATE' | 'SKIP';
  status: 'VALID' | 'INVALID' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'ROLLED_BACK';
  errors?: Array<{ row: number; column?: string; code: string; message: string }>;
  warnings?: {
    list?: Array<{ row: number; column?: string; code: string; message: string }>;
  };
  orderId?: string;
}

export interface OrderImportMapping {
  id: string;
  name: string;
  description?: string;
  isShared: boolean;
  mode: ImportMode;
  matchKey: MatchKey;
  columnMap: Record<string, string>;
  valueMaps?: Record<string, Record<string, string>>;
  defaults?: Record<string, any>;
  fileHints?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface UnmappedValuesResult {
  status?: Array<{ value: string; count: number; suggestion?: string }>;
  paymentStatus?: Array<{ value: string; count: number; suggestion?: string }>;
  carrierName?: Array<{ value: string; count: number; suggestion?: string }>;
  paymentMethod?: Array<{ value: string; count: number; suggestion?: string }>;
  source?: Array<{ value: string; count: number; suggestion?: string }>;
  products?: Array<{ value: string; count: number; inCatalog: boolean }>;
}

export interface ImportColumnDef {
  key: string;
  label: string;
  group: 'order' | 'customer' | 'address' | 'shipment' | 'item' | 'invoice' | 'payment';
}

export const SYSTEM_IMPORT_COLUMNS: ImportColumnDef[] = [
  // Sipariş
  { key: 'orderNumber', label: 'Sipariş Numarası', group: 'order' },
  { key: 'marketplaceOrderNumber', label: 'Pazaryeri Sipariş No', group: 'order' },
  { key: 'publicId', label: 'Genel Kimlik (Public ID)', group: 'order' },
  { key: 'orderDate', label: 'Sipariş Tarihi', group: 'order' },
  { key: 'status', label: 'Sipariş Durumu', group: 'order' },
  { key: 'paymentStatus', label: 'Ödeme Durumu', group: 'order' },
  { key: 'fulfillmentStatus', label: 'Kargo / Karşılama Durumu', group: 'order' },
  { key: 'source', label: 'Satış Kanalı / Kaynak', group: 'order' },
  { key: 'currency', label: 'Para Birimi', group: 'order' },
  { key: 'totalAmount', label: 'Toplam Tutar', group: 'order' },
  { key: 'notes', label: 'Sipariş Notu', group: 'order' },
  { key: 'tags', label: 'Etiketler', group: 'order' },
  { key: 'priority', label: 'Öncelik', group: 'order' },
  { key: 'isHold', label: 'Beklemede mi?', group: 'order' },
  // Müşteri
  { key: 'customerName', label: 'Müşteri Adı', group: 'customer' },
  { key: 'customerEmail', label: 'Müşteri E-Posta', group: 'customer' },
  { key: 'customerPhone', label: 'Müşteri Telefonu', group: 'customer' },
  // Adres
  { key: 'shippingLine1', label: 'Teslimat Adresi', group: 'address' },
  { key: 'shippingDistrict', label: 'Teslimat İlçesi', group: 'address' },
  { key: 'shippingCity', label: 'Teslimat İli / Şehir', group: 'address' },
  { key: 'shippingPostalCode', label: 'Posta Kodu', group: 'address' },
  { key: 'shippingCountryCode', label: 'Ülke Kodu', group: 'address' },
  // Kargo
  { key: 'carrierName', label: 'Kargo Firması', group: 'shipment' },
  { key: 'trackingNumber', label: 'Kargo Takip No', group: 'shipment' },
  { key: 'totalDesi', label: 'Toplam Desi', group: 'shipment' },
  { key: 'shippingFee', label: 'Kargo Ücreti', group: 'shipment' },
  // Kalem
  { key: 'itemName', label: 'Ürün Adı', group: 'item' },
  { key: 'itemSku', label: 'Ürün Kodu (SKU)', group: 'item' },
  { key: 'itemBarcode', label: 'Barkod', group: 'item' },
  { key: 'itemQuantity', label: 'Kalem Adedi', group: 'item' },
  { key: 'itemUnitPrice', label: 'Birim Fiyat', group: 'item' },
  { key: 'itemTaxRate', label: 'KDV Oranı (%)', group: 'item' },
  { key: 'itemDiscount', label: 'Kalem İndirimi', group: 'item' },
  { key: 'itemTotal', label: 'Kalem Toplamı', group: 'item' },
  { key: 'itemsSummary', label: 'Ürün Kalemleri Özeti', group: 'item' },
  { key: 'itemCount', label: 'Toplam Kalem Adedi', group: 'item' },
  // Fatura & Ödeme
  { key: 'invoiceNumber', label: 'Fatura Numarası', group: 'invoice' },
  { key: 'paymentMethod', label: 'Ödeme Yöntemi', group: 'payment' },
];
