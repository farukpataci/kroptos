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

/**
 * One row of `bg.local.goods.sku.list.query`.
 *
 * DOĞRULANAMADI, like the order shapes above: the request parameters of that
 * operation are established, its response is not. Every field is optional and
 * the mapper falls back rather than trusting any single spelling.
 *
 * `goodsId` matters beyond display: Temu keys stock by goods, not by the
 * seller's SKU code, so this is the field a future `updateStock` has to resolve
 * before it can send anything.
 */
export interface TemuSku {
  skuId?: string | number;
  goodsId?: string | number;
  /** The seller's own code, where one was set on the listing. */
  outSkuSn?: string;
  skuCode?: string;
  goodsName?: string;
  skuName?: string;
  thumbUrl?: string;
  /** Minor units, on the same assumption as the order endpoints. */
  price?: number;
  salePrice?: number;
  stockQuantity?: number;
  quantity?: number;
}
