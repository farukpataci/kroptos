/**
 * Temu Open Platform response shapes, narrowed to what this connector reads.
 *
 * DOĞRULANAMADI: every field below is inferred from Temu's RPC naming
 * conventions and general marketplace shape, not from a live response. The
 * mapper reads each value with a fallback so an unexpected spelling degrades to
 * a missing field rather than a crash — but the names still need checking
 * against a real payload.
 */

/** Temu wraps every response in a success flag and an error code. */
export interface TemuEnvelope<T> {
  success?: boolean;
  errorCode?: number;
  errorMsg?: string;
  result?: T;
}

export interface TemuOrderItem {
  skuId?: string | number;
  goodsId?: string | number;
  skuCode?: string;
  goodsName?: string;
  quantity?: number;
  /** Temu returns money in minor units (cents) on the endpoints seen so far. */
  unitPrice?: number;
  totalAmount?: number;
}

export interface TemuOrder {
  parentOrderSn?: string;
  orderSn?: string;
  orderStatus?: number | string;
  createdAt?: number;
  currency?: string;
  orderAmount?: number;
  receiverName?: string;
  receiverPhone?: string;
  receiverEmail?: string;
  addressDetail?: string;
  city?: string;
  countryCode?: string;
  itemList?: TemuOrderItem[];
}

export interface TemuOrderListResult {
  pageItems?: TemuOrder[];
  totalCount?: number;
}
