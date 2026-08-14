/** Shapes returned by eBay's Sell APIs, narrowed to what this connector reads. */

export interface EbayTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface EbayAmount {
  value?: string;
  currency?: string;
}

export interface EbayLineItem {
  lineItemId?: string;
  sku?: string;
  legacyItemId?: string;
  title?: string;
  quantity?: number;
  lineItemCost?: EbayAmount;
  total?: EbayAmount;
}

export interface EbayShippingAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface EbayOrder {
  orderId?: string;
  legacyOrderId?: string;
  orderFulfillmentStatus?: string;
  orderPaymentStatus?: string;
  buyer?: { username?: string; buyerRegistrationAddress?: { email?: string; fullName?: string } };
  pricingSummary?: { total?: EbayAmount };
  fulfillmentStartInstructions?: Array<{
    shippingStep?: {
      shipTo?: {
        fullName?: string;
        email?: string;
        primaryPhone?: { phoneNumber?: string };
        contactAddress?: EbayShippingAddress;
      };
    };
  }>;
  lineItems?: EbayLineItem[];
}

export interface EbayOrderPage {
  orders?: EbayOrder[];
  total?: number;
  limit?: number;
  offset?: number;
}

export interface EbayInventoryItem {
  sku?: string;
  product?: {
    title?: string;
    description?: string;
    imageUrls?: string[];
    ean?: string[];
    upc?: string[];
  };
  availability?: {
    shipToLocationAvailability?: { quantity?: number };
  };
}

export interface EbayInventoryPage {
  inventoryItems?: EbayInventoryItem[];
  total?: number;
  limit?: number;
  offset?: number;
}
