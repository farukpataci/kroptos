export interface TrendyolAddress {
  address1: string;
  city: string;
  country: string;
}

export interface TrendyolOrderLine {
  barcode: string;
  sku: string;
  quantity: number;
  price: number;
  merchantId: number;
  productName: string;
}

export interface TrendyolOrder {
  id: number;
  orderNumber: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail?: string;
  customerPhone?: string;
  shipmentAddress: TrendyolAddress;
  lines: TrendyolOrderLine[];
  status: string; // 'Created', 'Delivered', 'Cancelled', etc.
  totalPrice: number;
  currency: string;
}

export interface TrendyolProductImage {
  url: string;
}

export interface TrendyolProduct {
  title: string;
  stockCode: string; // SKU
  description?: string;
  salePrice: number;
  quantity: number;
  images: TrendyolProductImage[];
  barcode?: string;
}
