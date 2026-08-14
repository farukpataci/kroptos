export interface IdefixOrderItem {
  merchantSku: string; // SKU
  productName: string;
  quantity: number;
  price: number;
}

export interface IdefixOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address: string;
  city: string;
  district: string;
  status: string; // 'Created', 'Picking', 'Shipped', 'Delivered', 'Cancelled'
  totalPrice: number;
  currency: string;
  items: IdefixOrderItem[];
}

export interface IdefixProduct {
  merchantSku: string; // SKU
  title: string;
  description?: string;
  salePrice: number;
  quantity: number;
  image?: string;
  barcode?: string;
}
