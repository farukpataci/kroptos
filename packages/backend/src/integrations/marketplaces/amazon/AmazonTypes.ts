export interface AmazonBuyerInfo {
  BuyerName?: string;
  BuyerEmail?: string;
  BuyerPhone?: string;
}

export interface AmazonAddress {
  AddressLine1?: string;
  City?: string;
  StateOrRegion?: string;
  PostalCode?: string;
  CountryCode?: string;
}

export interface AmazonOrderItem {
  ASIN: string;
  SellerSKU: string;
  Title: string;
  QuantityOrdered: number;
  ItemPrice: {
    Amount: string; // Amazon SP-API returns pricing as string decimal
    CurrencyCode: string;
  };
}

export interface AmazonOrder {
  AmazonOrderId: string;
  PurchaseDate: string;
  BuyerInfo: AmazonBuyerInfo;
  ShippingAddress?: AmazonAddress;
  OrderStatus: string; // 'Pending' | 'Shipped' | 'Unshipped' | 'Canceled'
  OrderTotal: {
    Amount: string;
    CurrencyCode: string;
  };
  OrderItems: AmazonOrderItem[];
}

export interface AmazonProduct {
  asin: string;
  sku: string;
  attributes: {
    title: { value: string }[];
    description?: { value: string }[];
  };
  price: {
    amount: number;
    currency: string;
  };
  quantity: number;
  imageUrl?: string;
}
