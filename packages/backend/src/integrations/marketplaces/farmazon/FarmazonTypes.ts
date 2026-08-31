/**
 * Farmazon'un ham gövdelerinden okunan alanlar. Doküman sipariş için
 * `orderId`, `orderDate`, `orderStateId`, `orderPrice`, `buyerId`, `sellerId`,
 * `shipmentCompany`, `shipmentFollowUpNo` ve `orderDetails[]` adlarını veriyor;
 * satır içi alan adlarını vermiyor, o yüzden connector onları savunmacı okuyup
 * bu tiplere indirger.
 */
export interface FarmazonOrderItem {
  /** Farmazon ilaç/ürün tarafında barkodu birincil anahtar olarak kullanır. */
  barcode: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface FarmazonOrder {
  orderId: string;
  orderDate?: string;
  /** Bit değerli durum: 1, 2, 4, 32, 64, 512, 1024 (bkz. FarmazonConnector). */
  orderStateId: number;
  orderPrice: number;
  /** Alıcı eczanenin Farmazon kimliği. Doküman ad/adres alanı tanımlamıyor. */
  buyerId?: string;
  buyerName?: string;
  buyerPhone?: string;
  address?: string;
  district?: string;
  city?: string;
  postalCode?: string;
  shipmentCompany?: string;
  shipmentFollowUpNo?: string;
  items: FarmazonOrderItem[];
}

/**
 * Listing = satıcının bir ürüne verdiği fiyat/stok kaydı. Stok güncellemesi
 * ürünün değil, listing'in `id`'si üzerinden yapılır.
 */
export interface FarmazonListing {
  id: string;
  barcode: string;
  name: string;
  price: number;
  stock: number;
  /** 1 = aktif, 2 = pasif. */
  state?: number;
  image?: string;
}
