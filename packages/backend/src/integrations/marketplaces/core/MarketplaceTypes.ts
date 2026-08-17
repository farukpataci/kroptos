/**
 * Whether a payload came from the marketplace or from a connector's own sample
 * data. A connector whose endpoints are not verified yet can still be installed
 * and configured, but nothing it produces may pass for real: every result
 * carries this, and the worker refuses to persist simulated rows.
 */
export type MarketplaceMode = 'live' | 'simulation';

/** Which of the three inputs decided the mode, for logs and for the UI badge. */
export type MarketplaceModeSource = 'setting' | 'env' | 'default';

/** Mixed into every connector result so no payload is mode-ambiguous. */
export interface MarketplaceModeStamp {
  mode?: MarketplaceMode;
  modeSource?: MarketplaceModeSource;
}

export interface MarketplaceProduct extends MarketplaceModeStamp {
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

export interface MarketplaceOrder extends MarketplaceModeStamp {
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

export interface StockUpdateResult extends MarketplaceModeStamp {
  sku: string;
  quantity: number;
  success: boolean;
  error?: string;
}

export interface ConnectionTestResult extends MarketplaceModeStamp {
  success: boolean;
  message: string;
  durationMs: number;
}
