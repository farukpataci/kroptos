export interface CicekSepetiOrderItem {
  variantCode: string; // SKU
  name: string;
  quantity: number;
  price: number;
}

export interface CicekSepetiOrder {
  id: number;
  orderCode: string;
  receiverName: string;
  receiverPhone?: string;
  address: string;
  city: string;
  district: string;
  /** Passed through when the payload carries them; dropped before, silently. */
  neighborhood?: string;
  postalCode?: string;
  status: string; // 'Created', 'Shipped', 'Delivered', 'Cancelled'
  totalPrice: number;
  currency: string;
  items: CicekSepetiOrderItem[];
}

export interface CicekSepetiProduct {
  stockCode: string; // SKU
  name: string;
  description?: string;
  price: number;
  stock: number;
  mainImage?: string;
  barcode?: string;
}
