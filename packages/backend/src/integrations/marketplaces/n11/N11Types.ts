export interface N11Buyer {
  fullName: string;
  email?: string;
  gsm?: string;
}

export interface N11Address {
  address: string;
  city: string;
  district: string;
}

export interface N11OrderItem {
  productSellerCode: string; // SKU
  productName: string;
  quantity: number;
  price: number;
}

export interface N11Order {
  id: string;
  orderNumber: string;
  buyer: N11Buyer;
  shippingAddress: N11Address;
  orderItemList: {
    orderItem: N11OrderItem[];
  };
  status: number; // 1: New/Pending, 2: Shipped, 3: Delivered, 4: Cancelled
  totalPrice: number;
  currency: string;
}

export interface N11Product {
  stockCode: string; // SKU
  title: string;
  description?: string;
  salePrice: number;
  stockQuantity: number;
  image?: string;
  gtin?: string;
}
