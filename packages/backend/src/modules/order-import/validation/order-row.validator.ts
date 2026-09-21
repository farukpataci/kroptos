import { ValueParsers } from '../parsing/value-parsers';
import { ImportMode, MatchKey } from '../dto/order-import.dto';

export interface RowError {
  row: number;
  column?: string;
  code: string;
  message: string;
}

export interface RowWarning {
  row: number;
  column?: string;
  code: string;
  message: string;
}

export interface ParsedOrderItem {
  productId?: string;
  name: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discountAmount?: number;
  totalPrice?: number;
  isCatalogProduct: boolean;
}

export interface ParsedOrderData {
  orderNumber?: string;
  marketplaceOrderNumber?: string;
  publicId?: string;
  orderDate?: Date;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  source?: string;
  currency?: string;
  totalAmount?: number;
  shippingFee?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingLine1?: string;
  shippingDistrict?: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  shippingCountryCode?: string;
  carrierName?: string;
  trackingNumber?: string;
  totalDesi?: number;
  paymentMethod?: string;
  invoiceNumber?: string;
  notes?: string;
  tags?: string[];
  priority?: string;
  isHold?: boolean;
  items: ParsedOrderItem[];
}

export interface ValidatedOrderGroup {
  groupKey: string;
  rowNumbers: number[];
  action: 'CREATE' | 'UPDATE' | 'SKIP';
  status: 'VALID' | 'INVALID' | 'SKIPPED';
  errors: RowError[];
  warnings: RowWarning[];
  existingOrderId?: string;
  existingOrderNumber?: string;
  parsedOrder?: ParsedOrderData;
}

export interface ValidatorContext {
  mode: ImportMode;
  matchKey: MatchKey;
  columnMap: Record<string, string>; // fileHeader -> canonicalKey
  valueMaps: Record<string, Record<string, string>>; // field -> { fileValue: systemValue }
  allowNonCatalogProducts?: boolean;
  options?: {
    decimalSeparator?: ',' | '.' | 'auto';
    dayFirst?: boolean;
    timezone?: string;
  };
  // Pre-loaded store data for validation
  productsBySku: Map<string, { id: string; name: string; sku: string; price: any }>;
  productsByBarcode: Map<string, { id: string; name: string; sku: string; price: any }>;
  existingOrdersByMatchKey: Map<string, {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    totalAmount: any;
    invoiceNumber: string | null;
  }>;
}

const DEFAULT_STATUS_MAP: Record<string, string> = {
  beklemede: 'pending',
  pending: 'pending',
  hazirlaniyor: 'processing',
  processing: 'processing',
  islemde: 'processing',
  kargolandi: 'shipped',
  kargoda: 'shipped',
  shipped: 'shipped',
  dagitimda: 'out_for_delivery',
  outfordelivery: 'out_for_delivery',
  teslimedildi: 'delivered',
  delivered: 'delivered',
  tamamlandi: 'completed',
  completed: 'completed',
  iptal: 'cancelled',
  iptaledildi: 'cancelled',
  cancelled: 'cancelled',
  iade: 'returned',
  iadeedildi: 'returned',
  returned: 'returned',
};

const DEFAULT_PAYMENT_STATUS_MAP: Record<string, string> = {
  beklemede: 'pending',
  pending: 'pending',
  odendi: 'paid',
  paid: 'paid',
  basarisiz: 'failed',
  failed: 'failed',
  iade: 'refunded',
  refunded: 'refunded',
};

const DEFAULT_FULFILLMENT_STATUS_MAP: Record<string, string> = {
  karsilanmadi: 'unfulfilled',
  unfulfilled: 'unfulfilled',
  beklemede: 'unfulfilled',
  kismisevk: 'partially_fulfilled',
  partiallyfulfilled: 'partially_fulfilled',
  sevk: 'fulfilled',
  fulfilled: 'fulfilled',
  gonderildi: 'fulfilled',
};

export class OrderRowValidator {
  /**
   * Validate a group of file rows that belong to the same order.
   */
  static validateGroup(
    groupKey: string,
    rawRows: Array<{ rowNumber: number; data: Record<string, any> }>,
    ctx: ValidatorContext,
  ): ValidatedOrderGroup {
    const rowNumbers = rawRows.map((r) => r.rowNumber);
    const errors: RowError[] = [];
    const warnings: RowWarning[] = [];

    // Reverse columnMap to know canonicalKey -> fileHeader
    const fieldToFileHeader: Record<string, string> = {};
    for (const [fileHeader, canonicalKey] of Object.entries(ctx.columnMap)) {
      fieldToFileHeader[canonicalKey] = fileHeader;
    }

    // Helper to get raw value for canonical field
    const getVal = (data: Record<string, any>, field: string): any => {
      const header = fieldToFileHeader[field];
      if (!header) return undefined;
      return data[header];
    };

    // 1. Existing order lookup
    const existingOrder = ctx.existingOrdersByMatchKey.get(groupKey.trim());

    // 2. Mode enforcement
    let action: 'CREATE' | 'UPDATE' | 'SKIP' = 'CREATE';
    if (ctx.mode === 'CREATE_ONLY') {
      if (existingOrder) {
        action = 'SKIP';
        warnings.push({
          row: rowNumbers[0],
          code: 'ORDER_EXISTS_SKIPPED',
          message: `Sipariş '${groupKey}' zaten mevcut olduğundan CREATE_ONLY modunda atlandı.`,
        });
        return {
          groupKey,
          rowNumbers,
          action,
          status: 'SKIPPED',
          errors,
          warnings,
          existingOrderId: existingOrder.id,
          existingOrderNumber: existingOrder.orderNumber,
        };
      }
      action = 'CREATE';
    } else if (ctx.mode === 'UPDATE_ONLY') {
      if (!existingOrder) {
        action = 'SKIP';
        warnings.push({
          row: rowNumbers[0],
          code: 'ORDER_NOT_FOUND_SKIPPED',
          message: `Sipariş '${groupKey}' sistemde bulunamadığından UPDATE_ONLY modunda atlandı.`,
        });
        return {
          groupKey,
          rowNumbers,
          action,
          status: 'SKIPPED',
          errors,
          warnings,
        };
      }
      action = 'UPDATE';
    } else {
      // UPSERT
      action = existingOrder ? 'UPDATE' : 'CREATE';
    }

    // 3. Extract order-level fields and detect conflicts across group rows
    const firstRow = rawRows[0];
    const orderLevelFields = [
      'orderDate', 'customerName', 'customerEmail', 'customerPhone',
      'shippingLine1', 'shippingDistrict', 'shippingCity', 'shippingPostalCode', 'shippingCountryCode',
      'carrierName', 'trackingNumber', 'totalAmount', 'currency', 'status', 'paymentStatus',
      'fulfillmentStatus', 'source', 'paymentMethod', 'invoiceNumber', 'notes',
    ];

    for (const field of orderLevelFields) {
      const firstVal = getVal(firstRow.data, field);
      for (let i = 1; i < rawRows.length; i++) {
        const nextVal = getVal(rawRows[i].data, field);
        if (
          firstVal !== undefined &&
          nextVal !== undefined &&
          String(firstVal).trim() !== '' &&
          String(nextVal).trim() !== '' &&
          String(firstVal).trim() !== String(nextVal).trim()
        ) {
          errors.push({
            row: rawRows[i].rowNumber,
            column: fieldToFileHeader[field],
            code: 'CONFLICTING_ORDER_VALUES',
            message: `Aynı siparişte (${groupKey}) '${field}' alanı için satırlar arası çelişkili değerler: '${firstVal}' vs '${nextVal}'`,
          });
        }
      }
    }

    // 4. Parse order-level values
    const rawOrderDate = getVal(firstRow.data, 'orderDate');
    let orderDate: Date | undefined;
    if (rawOrderDate) {
      const parsed = ValueParsers.parseDate(rawOrderDate, {
        dayFirst: ctx.options?.dayFirst ?? true,
        timezone: ctx.options?.timezone,
      });
      if (!parsed) {
        errors.push({
          row: firstRow.rowNumber,
          column: fieldToFileHeader['orderDate'],
          code: 'INVALID_DATE',
          message: `Geçersiz sipariş tarihi: '${rawOrderDate}'`,
        });
      } else {
        orderDate = parsed;
      }
    } else if (action === 'CREATE') {
      orderDate = new Date();
    }

    // Status mapping helper
    const resolveMappedValue = (field: string, raw: any, defaultMap: Record<string, string>): string | undefined => {
      if (raw === null || raw === undefined || String(raw).trim() === '') return undefined;
      const str = String(raw).trim();
      // 1. Explicit value map configured by user
      const userMap = ctx.valueMaps[field];
      if (userMap && userMap[str]) {
        return userMap[str];
      }
      // 2. Default normalized dictionary
      const norm = str.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (defaultMap[norm]) {
        return defaultMap[norm];
      }
      // 3. If it is already a valid system key
      if (Object.values(defaultMap).includes(norm)) {
        return norm;
      }
      return undefined;
    };

    const rawStatus = getVal(firstRow.data, 'status');
    let status: string | undefined;
    if (rawStatus) {
      status = resolveMappedValue('status', rawStatus, DEFAULT_STATUS_MAP);
      if (!status) {
        errors.push({
          row: firstRow.rowNumber,
          column: fieldToFileHeader['status'],
          code: 'UNMAPPED_STATUS',
          message: `Tanımlanamayan sipariş durumu: '${rawStatus}'. Lütfen Değer Eşleme adımında eşleştirin.`,
        });
      }
    } else if (action === 'CREATE') {
      status = 'pending';
    }

    const rawPaymentStatus = getVal(firstRow.data, 'paymentStatus');
    let paymentStatus: string | undefined;
    if (rawPaymentStatus) {
      paymentStatus = resolveMappedValue('paymentStatus', rawPaymentStatus, DEFAULT_PAYMENT_STATUS_MAP);
      if (!paymentStatus) {
        errors.push({
          row: firstRow.rowNumber,
          column: fieldToFileHeader['paymentStatus'],
          code: 'UNMAPPED_PAYMENT_STATUS',
          message: `Tanımlanamayan ödeme durumu: '${rawPaymentStatus}'`,
        });
      }
    } else if (action === 'CREATE') {
      paymentStatus = 'pending';
    }

    const rawFulfillmentStatus = getVal(firstRow.data, 'fulfillmentStatus');
    let fulfillmentStatus: string | undefined;
    if (rawFulfillmentStatus) {
      fulfillmentStatus = resolveMappedValue('fulfillmentStatus', rawFulfillmentStatus, DEFAULT_FULFILLMENT_STATUS_MAP);
      if (!fulfillmentStatus) {
        warnings.push({
          row: firstRow.rowNumber,
          column: fieldToFileHeader['fulfillmentStatus'],
          code: 'UNMAPPED_FULFILLMENT_STATUS',
          message: `Kargo durumu tanınamadı, 'unfulfilled' kabul edildi: '${rawFulfillmentStatus}'`,
        });
        fulfillmentStatus = 'unfulfilled';
      }
    }

    // Customer & Contact parsing
    const customerName = ValueParsers.cleanString(getVal(firstRow.data, 'customerName'), 100);
    const customerEmail = ValueParsers.cleanString(getVal(firstRow.data, 'customerEmail'), 120);
    const rawPhone = getVal(firstRow.data, 'customerPhone');
    const phoneResult = ValueParsers.parsePhone(rawPhone);
    if (phoneResult.warning) {
      warnings.push({
        row: firstRow.rowNumber,
        column: fieldToFileHeader['customerPhone'],
        code: 'PHONE_FORMAT_WARNING',
        message: phoneResult.warning,
      });
    }

    if (action === 'CREATE' && !customerName) {
      // Missing customer name in CREATE
      errors.push({
        row: firstRow.rowNumber,
        column: fieldToFileHeader['customerName'],
        code: 'MISSING_CUSTOMER_NAME',
        message: 'Yeni oluşturulacak siparişte Müşteri Adı zorunludur.',
      });
    }

    const shippingLine1 = ValueParsers.cleanString(getVal(firstRow.data, 'shippingLine1'), 250);
    const shippingDistrict = ValueParsers.cleanString(getVal(firstRow.data, 'shippingDistrict'), 80);
    const shippingCity = ValueParsers.cleanString(getVal(firstRow.data, 'shippingCity'), 80);
    const shippingPostalCode = ValueParsers.cleanString(getVal(firstRow.data, 'shippingPostalCode'), 20);
    const shippingCountryCode = ValueParsers.cleanString(getVal(firstRow.data, 'shippingCountryCode'), 10) || 'TR';

    // Financial parsing
    const rawTotalAmount = getVal(firstRow.data, 'totalAmount');
    const totalAmount = ValueParsers.parseNumber(rawTotalAmount, {
      decimalSeparator: ctx.options?.decimalSeparator,
    });

    const rawShippingFee = getVal(firstRow.data, 'shippingFee');
    const shippingFee = ValueParsers.parseNumber(rawShippingFee, {
      decimalSeparator: ctx.options?.decimalSeparator,
    }) || 0;

    const currency = ValueParsers.cleanString(getVal(firstRow.data, 'currency'), 10) || 'TRY';
    const source = ValueParsers.cleanString(getVal(firstRow.data, 'source'), 50) || 'manual';
    const carrierName = ValueParsers.cleanString(getVal(firstRow.data, 'carrierName'), 100);
    const trackingNumber = ValueParsers.cleanString(getVal(firstRow.data, 'trackingNumber'), 100);
    const rawDesi = getVal(firstRow.data, 'totalDesi');
    const totalDesi = ValueParsers.parseNumber(rawDesi);
    const paymentMethod = ValueParsers.cleanString(getVal(firstRow.data, 'paymentMethod'), 100);
    const invoiceNumber = ValueParsers.cleanString(getVal(firstRow.data, 'invoiceNumber'), 100);
    const notes = ValueParsers.cleanString(getVal(firstRow.data, 'notes'), 1000);
    const tagsStr = ValueParsers.cleanString(getVal(firstRow.data, 'tags'));
    const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    const priority = ValueParsers.cleanString(getVal(firstRow.data, 'priority'), 30);
    const isHold = ValueParsers.parseBoolean(getVal(firstRow.data, 'isHold')) ?? undefined;

    // 5. Parse and validate items
    const parsedItems: ParsedOrderItem[] = [];
    let calculatedItemsTotal = 0;

    for (const row of rawRows) {
      const rawSku = getVal(row.data, 'itemSku');
      const rawBarcode = getVal(row.data, 'itemBarcode');
      const rawItemName = getVal(row.data, 'itemName');
      const rawQty = getVal(row.data, 'itemQuantity');
      const rawUnitPrice = getVal(row.data, 'itemUnitPrice');
      const rawTaxRate = getVal(row.data, 'itemTaxRate');
      const rawDiscount = getVal(row.data, 'itemDiscount');
      const rawItemTotal = getVal(row.data, 'itemTotal');

      // Check if this row actually specifies an item
      const hasItemData = rawSku || rawBarcode || rawItemName || rawQty !== undefined || rawUnitPrice !== undefined;
      if (!hasItemData) {
        continue;
      }

      const sku = ValueParsers.cleanString(rawSku, 100);
      const barcode = ValueParsers.cleanString(rawBarcode, 100);
      const name = ValueParsers.cleanString(rawItemName, 255) || sku || barcode || 'Ürün';

      const qty = ValueParsers.parseNumber(rawQty, { decimalSeparator: ctx.options?.decimalSeparator }) ?? 1;
      if (qty <= 0) {
        errors.push({
          row: row.rowNumber,
          column: fieldToFileHeader['itemQuantity'],
          code: 'INVALID_QUANTITY',
          message: `Ürün adedi 0'dan büyük olmalıdır: '${rawQty}'`,
        });
      }

      const unitPrice = ValueParsers.parseNumber(rawUnitPrice, { decimalSeparator: ctx.options?.decimalSeparator }) ?? 0;
      if (unitPrice < 0) {
        errors.push({
          row: row.rowNumber,
          column: fieldToFileHeader['itemUnitPrice'],
          code: 'INVALID_PRICE',
          message: `Birim fiyat negatif olamaz: '${rawUnitPrice}'`,
        });
      }

      const taxRate = ValueParsers.parseNumber(rawTaxRate) ?? 20;
      const discountAmount = ValueParsers.parseNumber(rawDiscount, { decimalSeparator: ctx.options?.decimalSeparator }) ?? 0;
      const parsedItemTotal = ValueParsers.parseNumber(rawItemTotal, { decimalSeparator: ctx.options?.decimalSeparator }) ??
        (unitPrice * qty - discountAmount);

      calculatedItemsTotal += parsedItemTotal;

      // Product matching in catalog
      let matchedProduct = sku ? ctx.productsBySku.get(sku.toLowerCase()) : undefined;
      if (!matchedProduct && barcode) {
        matchedProduct = ctx.productsByBarcode.get(barcode.toLowerCase());
      }

      if (!matchedProduct) {
        if (ctx.allowNonCatalogProducts) {
          warnings.push({
            row: row.rowNumber,
            column: fieldToFileHeader['itemSku'] || fieldToFileHeader['itemBarcode'],
            code: 'PRODUCT_NOT_IN_CATALOG',
            message: `'${sku || barcode || name}' katalogda bulunamadı, serbest kalem olarak eklenecek.`,
          });
          parsedItems.push({
            name,
            sku: sku || undefined,
            barcode: barcode || undefined,
            quantity: qty,
            unitPrice,
            taxRate,
            discountAmount,
            totalPrice: parsedItemTotal,
            isCatalogProduct: false,
          });
        } else if (action === 'CREATE') {
          errors.push({
            row: row.rowNumber,
            column: fieldToFileHeader['itemSku'] || fieldToFileHeader['itemBarcode'],
            code: 'PRODUCT_NOT_FOUND',
            message: `Ürün kodu '${sku || barcode || name}' mağaza kataloğunda bulunamadı.`,
          });
        }
      } else {
        parsedItems.push({
          productId: matchedProduct.id,
          name: matchedProduct.name,
          sku: matchedProduct.sku,
          quantity: qty,
          unitPrice,
          taxRate,
          discountAmount,
          totalPrice: parsedItemTotal,
          isCatalogProduct: true,
        });
      }
    }

    // For CREATE, at least one item is mandatory
    if (action === 'CREATE' && parsedItems.length === 0) {
      errors.push({
        row: firstRow.rowNumber,
        code: 'NO_ITEMS',
        message: 'Yeni oluşturulacak sipariş en az bir ürün kalemi içermelidir.',
      });
    }

    // Pricing consistency check
    if (totalAmount !== null && parsedItems.length > 0) {
      const expectedTotal = calculatedItemsTotal + shippingFee;
      const diff = Math.abs(totalAmount - expectedTotal);
      if (diff > 0.05) {
        warnings.push({
          row: firstRow.rowNumber,
          column: fieldToFileHeader['totalAmount'],
          code: 'TOTAL_AMOUNT_MISMATCH',
          message: `Toplam tutar (${totalAmount}) ile kalemler + kargo toplamı (${expectedTotal.toFixed(2)}) arasında fark var (fark: ${diff.toFixed(2)}).`,
        });
      }
    }

    // Protected field check on UPDATE
    if (action === 'UPDATE' && existingOrder) {
      if (existingOrder.invoiceNumber && totalAmount !== null && Number(existingOrder.totalAmount) !== totalAmount) {
        warnings.push({
          row: firstRow.rowNumber,
          code: 'INVOICED_ORDER_PROTECTED',
          message: `Sipariş #${existingOrder.orderNumber} faturalandırılmış olduğu için tutarı değiştirilmeyecek.`,
        });
      }
    }

    const isValid = errors.length === 0;

    return {
      groupKey,
      rowNumbers,
      action,
      status: isValid ? 'VALID' : 'INVALID',
      errors,
      warnings,
      existingOrderId: existingOrder?.id,
      existingOrderNumber: existingOrder?.orderNumber,
      parsedOrder: {
        orderNumber: ctx.matchKey === 'orderNumber' ? groupKey : getVal(firstRow.data, 'orderNumber'),
        marketplaceOrderNumber: ctx.matchKey === 'marketplaceOrderNumber' ? groupKey : getVal(firstRow.data, 'marketplaceOrderNumber'),
        publicId: ctx.matchKey === 'publicId' ? groupKey : getVal(firstRow.data, 'publicId'),
        orderDate,
        status,
        paymentStatus,
        fulfillmentStatus,
        source,
        currency,
        totalAmount: totalAmount ?? (calculatedItemsTotal + shippingFee),
        shippingFee,
        customerName,
        customerEmail: customerEmail || undefined,
        customerPhone: phoneResult.phone || undefined,
        shippingLine1,
        shippingDistrict,
        shippingCity,
        shippingPostalCode,
        shippingCountryCode,
        carrierName,
        trackingNumber,
        totalDesi: totalDesi !== null ? totalDesi : undefined,
        paymentMethod,
        invoiceNumber,
        notes,
        tags,
        priority,
        isHold,
        items: parsedItems,
      },
    };
  }
}
