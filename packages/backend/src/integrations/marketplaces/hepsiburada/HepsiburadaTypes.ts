export interface HepsiburadaCustomer {
  name: string;
  email?: string;
  phone?: string;
}

export interface HepsiburadaShippingAddress {
  address: string;
  city: string;
  town: string;
}

export interface HepsiburadaItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

export interface HepsiburadaOrder {
  id: string;
  orderNumber: string;
  customer: HepsiburadaCustomer;
  shippingAddress: HepsiburadaShippingAddress;
  items: HepsiburadaItem[];
  status: string; // 'Open', 'Shipped', 'Delivered', 'Cancelled'
  totalAmount: number;
  currency: string;
}

export interface HepsiburadaProduct {
  hepsiburadaSku: string;
  merchantSku: string; // SKU
  name: string;
  description?: string;
  price: number;
  stock: number;
  image?: string;
  barcode?: string;
}
