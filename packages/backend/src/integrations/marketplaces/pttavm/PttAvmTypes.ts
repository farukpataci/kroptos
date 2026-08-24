export interface PttAvmOrderItem {
  stockCode: string; // SKU
  productName: string;
  quantity: number;
  price: number;
}

export interface PttAvmOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address: string;
  city: string;
  district: string;
  /** Passed through when the payload carries them; dropped before, silently. */
  neighborhood?: string;
  postalCode?: string;
  status: string; // 'New', 'Approved', 'Shipped', 'Delivered', 'Cancelled'
  totalPrice: number;
  currency: string;
  items: PttAvmOrderItem[];
}

export interface PttAvmProduct {
  stockCode: string; // SKU
  name: string;
  description?: string;
  price: number;
  quantity: number;
  image?: string;
  barcode?: string;
}
