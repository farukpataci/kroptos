export interface PazaramaOrderItem {
  stockCode: string; // SKU
  productName: string;
  quantity: number;
  price: number;
}

export interface PazaramaOrder {
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
  status: string; // 'New', 'Preparing', 'Shipped', 'Delivered', 'Cancelled'
  totalPrice: number;
  currency: string;
  items: PazaramaOrderItem[];
}

export interface PazaramaProduct {
  code: string; // SKU / stock code
  name: string;
  description?: string;
  salePrice: number;
  stockCount: number;
  image?: string;
  barcode?: string;
}
