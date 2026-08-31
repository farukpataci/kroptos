import { MarketplaceOrder, MarketplaceOrderItem, MarketplaceProduct } from '../core/MarketplaceTypes';
import { FarmazonListing, FarmazonOrder } from './FarmazonTypes';

/** Dokümanın `orderState` filtresinde saydığı değerler. */
const ORDER_STATE: Record<number, string> = {
  1: 'pending', // satıcı onayı bekliyor
  2: 'processing', // kargoya verilmeyi bekliyor
  4: 'shipped', // yolda
  32: 'delivered', // tamamlandı
  64: 'cancelled',
  512: 'pending', // alıcı onayı bekliyor
  1024: 'pending', // ön sipariş
};

export class FarmazonMapper {
  static toUnifiedOrder(order: FarmazonOrder): MarketplaceOrder {
    const items: MarketplaceOrderItem[] = order.items.map((item) => ({
      // Farmazon ilaç tarafında SKU değil barkod taşır; ürün eşlemesi de
      // barkodla yapıldığı için sku alanına barkod yazılır.
      sku: item.barcode,
      name: item.productName || 'Farmazon Ürünü',
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
    }));

    const status = ORDER_STATE[order.orderStateId] ?? 'pending';

    return {
      orderNumber: order.orderId,
      // Farmazon eczaneler arası bir pazaryeri: doküman alıcı adı/adresi
      // tanımlamıyor. Uydurmak yerine alıcının kimliği yazılır.
      customerName: order.buyerName || (order.buyerId ? `Farmazon Alıcı #${order.buyerId}` : 'Farmazon Alıcı'),
      customerPhone: order.buyerPhone,
      shippingAddress: [order.address, order.district, order.city].filter(Boolean).join(', ') || undefined,
      shippingFullName: order.buyerName,
      shippingPhone: order.buyerPhone,
      shippingLine1: order.address,
      shippingDistrict: order.district,
      shippingCity: order.city,
      shippingPostalCode: order.postalCode,
      shippingCountryCode: 'TR',
      status,
      paymentStatus: status === 'cancelled' ? 'failed' : 'paid',
      totalAmount: order.orderPrice,
      currency: 'TRY',
      source: 'farmazon',
      shipping:
        order.shipmentCompany || order.shipmentFollowUpNo
          ? { carrierName: order.shipmentCompany, trackingNumber: order.shipmentFollowUpNo }
          : undefined,
      items,
    };
  }

  static toUnifiedProduct(listing: FarmazonListing): MarketplaceProduct {
    return {
      sku: listing.barcode,
      name: listing.name,
      price: listing.price,
      stockQuantity: listing.stock,
      image: listing.image,
      barcode: listing.barcode,
    };
  }
}
