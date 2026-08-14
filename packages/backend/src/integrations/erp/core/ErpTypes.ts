export interface ErpProduct {
  sku: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  barcode?: string;
  erpCode?: string;
}

export interface ErpOrderItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface ErpOrder {
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  totalAmount: number;
  currency: string;
  items: ErpOrderItem[];
  warehouseNo?: string;
}

export interface ErpStock {
  sku: string;
  quantity: number;
}

export interface ErpConnectionTestResult {
  success: boolean;
  message: string;
  durationMs: number;
}
