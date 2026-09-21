export interface ExportColumnDef {
  key: string;
  label: string;
  group: 'order' | 'customer' | 'address' | 'payment' | 'shipment' | 'item' | 'invoice';
  type: 'string' | 'number' | 'money' | 'date' | 'boolean';
  rowModes: ('ORDER' | 'LINE_ITEM')[];
  pii: boolean;
  resolve: (order: any, item?: any, options?: { timezone?: string }) => any;
}

/**
 * CSV / Spreadsheet formula injection protection (docs/export.md §3):
 * Metin hücreleri '=', '+', '-', '@', '\t', '\r' ile başlıyorsa başına tek tırnak eklenir.
 */
export function escapeFormula(val: any): any {
  if (typeof val !== 'string') return val;
  if (/^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

function formatDate(date: any, timezone = 'Europe/Istanbul'): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('tr-TR', { timeZone: timezone, hour12: false });
  } catch {
    return new Date(date).toISOString();
  }
}

export const EXPORT_COLUMNS: ExportColumnDef[] = [
  // ==================== SIPARIŞ ====================
  {
    key: 'orderNumber',
    label: 'Sipariş Numarası',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => escapeFormula(order.orderNumber || order.id),
  },
  {
    key: 'publicId',
    label: 'Genel Kimlik (Public ID)',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => order.publicId || order.id,
  },
  {
    key: 'orderDate',
    label: 'Sipariş Tarihi',
    group: 'order',
    type: 'date',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order, _, opts) => formatDate(order.createdAt, opts?.timezone),
  },
  {
    key: 'status',
    label: 'Sipariş Durumu',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => order.status,
  },
  {
    key: 'paymentStatus',
    label: 'Ödeme Durumu',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => order.paymentStatus || 'pending',
  },
  {
    key: 'fulfillmentStatus',
    label: 'Kargo / Karşılama Durumu',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => order.fulfillmentStatus || 'unfulfilled',
  },
  {
    key: 'source',
    label: 'Satış Kanalı / Kaynak',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => order.source || 'manual',
  },
  {
    key: 'currency',
    label: 'Para Birimi',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => order.currency || 'TRY',
  },
  {
    key: 'totalAmount',
    label: 'Toplam Tutar',
    group: 'order',
    type: 'money',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => Number(order.totalAmount || 0),
  },
  {
    key: 'notes',
    label: 'Sipariş Notu',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => escapeFormula(order.notes || ''),
  },
  {
    key: 'tags',
    label: 'Etiketler',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => (Array.isArray(order.tags) ? order.tags.join(', ') : ''),
  },
  {
    key: 'priority',
    label: 'Öncelik',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => order.priority || 'normal',
  },
  {
    key: 'isHold',
    label: 'Beklemede mi?',
    group: 'order',
    type: 'boolean',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => (order.isHold ? 'Evet' : 'Hayır'),
  },

  // ==================== MÜŞTERI (PII) ====================
  {
    key: 'customerName',
    label: 'Müşteri Adı',
    group: 'customer',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: true,
    resolve: (order) => escapeFormula(order.customerName || ''),
  },
  {
    key: 'customerEmail',
    label: 'Müşteri E-Posta',
    group: 'customer',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: true,
    resolve: (order) => escapeFormula(order.customerEmail || ''),
  },
  {
    key: 'customerPhone',
    label: 'Müşteri Telefonu',
    group: 'customer',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: true,
    resolve: (order) => escapeFormula(order.customerPhone || ''),
  },

  // ==================== ADRES (PII) ====================
  {
    key: 'shippingLine1',
    label: 'Teslimat Adresi',
    group: 'address',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: true,
    resolve: (order) => escapeFormula(order.shippingLine1 || ''),
  },
  {
    key: 'shippingDistrict',
    label: 'Teslimat İlçesi',
    group: 'address',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: true,
    resolve: (order) => escapeFormula(order.shippingDistrict || ''),
  },
  {
    key: 'shippingCity',
    label: 'Teslimat İli / Şehir',
    group: 'address',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: true,
    resolve: (order) => escapeFormula(order.shippingCity || ''),
  },
  {
    key: 'shippingPostalCode',
    label: 'Posta Kodu',
    group: 'address',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: true,
    resolve: (order) => escapeFormula(order.shippingPostalCode || ''),
  },
  {
    key: 'shippingCountryCode',
    label: 'Ülke Kodu',
    group: 'address',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => order.shippingCountryCode || 'TR',
  },

  // ==================== SEVKIYAT & KARGO ====================
  {
    key: 'carrierName',
    label: 'Kargo Firması',
    group: 'shipment',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => order.shipmentCarrier || order.carrier || '',
  },
  {
    key: 'trackingNumber',
    label: 'Kargo Takip No',
    group: 'shipment',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => escapeFormula(order.trackingNumber || ''),
  },
  {
    key: 'totalDesi',
    label: 'Toplam Desi',
    group: 'shipment',
    type: 'number',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => Number(order.desi || 0),
  },

  // ==================== KALEM (LINE_ITEM & ORDER) ====================
  {
    key: 'itemsSummary',
    label: 'Ürün Kalemleri Özeti',
    group: 'item',
    type: 'string',
    rowModes: ['ORDER'],
    pii: false,
    resolve: (order) => {
      if (!Array.isArray(order.items)) return '';
      return order.items.map((it: any) => `${it.name || it.sku} x${it.quantity || 1}`).join('; ');
    },
  },
  {
    key: 'itemCount',
    label: 'Toplam Kalem Adedi',
    group: 'item',
    type: 'number',
    rowModes: ['ORDER'],
    pii: false,
    resolve: (order) => {
      if (!Array.isArray(order.items)) return 0;
      return order.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
    },
  },
  {
    key: 'itemName',
    label: 'Ürün Adı',
    group: 'item',
    type: 'string',
    rowModes: ['LINE_ITEM'],
    pii: false,
    resolve: (_, item) => escapeFormula(item?.name || ''),
  },
  {
    key: 'itemSku',
    label: 'Ürün Kodu (SKU)',
    group: 'item',
    type: 'string',
    rowModes: ['LINE_ITEM'],
    pii: false,
    resolve: (_, item) => escapeFormula(item?.sku || ''),
  },
  {
    key: 'itemBarcode',
    label: 'Barkod',
    group: 'item',
    type: 'string',
    rowModes: ['LINE_ITEM'],
    pii: false,
    resolve: (_, item) => escapeFormula(item?.barcode || ''),
  },
  {
    key: 'itemQuantity',
    label: 'Kalem Adedi',
    group: 'item',
    type: 'number',
    rowModes: ['LINE_ITEM'],
    pii: false,
    resolve: (_, item) => Number(item?.quantity || 1),
  },
  {
    key: 'itemUnitPrice',
    label: 'Birim Fiyat',
    group: 'item',
    type: 'money',
    rowModes: ['LINE_ITEM'],
    pii: false,
    resolve: (_, item) => Number(item?.unitPrice || 0),
  },
  {
    key: 'itemTaxRate',
    label: 'KDV Oranı (%)',
    group: 'item',
    type: 'number',
    rowModes: ['LINE_ITEM'],
    pii: false,
    resolve: (_, item) => Number(item?.taxRate || 20),
  },
  {
    key: 'itemDiscount',
    label: 'Kalem İndirimi',
    group: 'item',
    type: 'money',
    rowModes: ['LINE_ITEM'],
    pii: false,
    resolve: (_, item) => Number(item?.discountAmount || 0),
  },
  {
    key: 'itemTotal',
    label: 'Kalem Toplamı',
    group: 'item',
    type: 'money',
    rowModes: ['LINE_ITEM'],
    pii: false,
    resolve: (_, item) => Number(item?.totalPrice || item?.unitPrice * (item?.quantity || 1) || 0),
  },

  // ==================== FATURA ====================
  {
    key: 'invoiceNumber',
    label: 'Fatura Numarası',
    group: 'invoice',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => escapeFormula(order.invoiceNumber || ''),
  },
  {
    key: 'shippingFee',
    label: 'Kargo Ücreti',
    group: 'order',
    type: 'money',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => Number(order.shippingPrice || 0),
  },
  {
    key: 'paymentMethod',
    label: 'Ödeme Yöntemi',
    group: 'payment',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => order.paymentMethod || 'Kredi Kartı',
  },
  {
    key: 'marketplaceOrderNumber',
    label: 'Pazaryeri Sipariş No',
    group: 'order',
    type: 'string',
    rowModes: ['ORDER', 'LINE_ITEM'],
    pii: false,
    resolve: (order) => escapeFormula(order.marketplaceOrderId || order.orderNumber || ''),
  },
];

export const COLUMNS_MAP = new Map<string, ExportColumnDef>(
  EXPORT_COLUMNS.map((c) => [c.key, c]),
);

export function getAvailableColumns(canPii: boolean, rowMode?: 'ORDER' | 'LINE_ITEM'): ExportColumnDef[] {
  return EXPORT_COLUMNS.filter((col) => {
    if (!canPii && col.pii) return false;
    if (rowMode && !col.rowModes.includes(rowMode)) return false;
    return true;
  });
}
