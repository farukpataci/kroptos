export interface MarketplaceProduct {
  sku: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  image?: string;
  barcode?: string;
}

export interface MarketplaceOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface MarketplaceOrder {
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  status: string; // 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  paymentStatus: string; // 'pending' | 'paid' | 'failed'
  totalAmount: number;
  currency: string;
  source: string; // provider name, e.g., 'trendyol', 'hepsiburada', etc.
  items: MarketplaceOrderItem[];
}

export interface StockUpdateResult {
  sku: string;
  quantity: number;
  success: boolean;
  error?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  durationMs: number;
}
