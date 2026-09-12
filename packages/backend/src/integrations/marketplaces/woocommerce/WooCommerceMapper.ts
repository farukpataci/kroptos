import {
  MarketplaceOrder,
  MarketplaceOrderItem,
  MarketplaceProduct,
} from '../core/MarketplaceTypes';
import {
  WooCommerceAddress,
  WooCommerceProductVariation,
  WooCommerceRawOrder,
  WooCommerceRawProduct,
} from './WooCommerceTypes';

export class WooCommerceMapper {
  /**
   * Safely parses WooCommerce price/amount string or number into a standard float number.
   * WooCommerce sends monetary amounts as strings (e.g. "49.90").
   */
  static parseAmount(value: string | number | undefined | null): number {
    if (value === undefined || value === null || value === '') return 0;
    const cleanStr = String(value).trim().replace(',', '.');
    const num = parseFloat(cleanStr);
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  }

  /**
   * Normalizes WooCommerce order statuses to KroptOS OrderStatus strings.
   * 
   * CRITICAL RULE (KARAR-2 / docs §7.1):
   * An unknown status MUST NEVER be mapped to a terminal status ('completed', 'cancelled', 'returned').
   * Default fallback is strictly 'pending'.
   */
  static mapOrderStatus(rawStatus: string): string | null {
    const status = String(rawStatus ?? '').trim().toLowerCase();

    // Drafts and trash must not be imported as active orders
    if (status === 'checkout-draft' || status === 'trash' || status === 'auto-draft') {
      return null;
    }

    switch (status) {
      case 'pending':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'on-hold':
        return 'pending';
      case 'completed':
        return 'delivered';
      case 'cancelled':
        return 'cancelled';
      case 'refunded':
        return 'returned';
      case 'failed':
        return 'cancelled';
      default:
        // Unknown status fallback is strictly pending
        return 'pending';
    }
  }

  /**
   * Normalizes payment status based on WooCommerce order attributes.
   */
  static mapPaymentStatus(order: WooCommerceRawOrder): string {
    const status = String(order.status ?? '').toLowerCase();
    if (status === 'refunded') return 'refunded';
    if (order.date_paid || status === 'completed' || status === 'processing') {
      return 'paid';
    }
    if (status === 'failed') return 'failed';
    return 'pending';
  }

  /**
   * Extracts structured carrier address fields from WooCommerce shipping (or billing fallback) block.
   */
  static extractCarrierAddress(order: WooCommerceRawOrder) {
    const addr: WooCommerceAddress = order.shipping?.address_1 ? order.shipping : (order.billing || {});
    const fullName = `${addr.first_name || ''} ${addr.last_name || ''}`.trim() || order.customer_note || 'Müşteri';
    const phone = addr.phone || order.billing?.phone || undefined;
    const line1 = addr.address_1?.trim() || undefined;
    const line2 = addr.address_2?.trim() || undefined;
    const city = addr.city?.trim() || undefined;
    const district = addr.state?.trim() || undefined;
    const postalCode = addr.postcode?.trim() || undefined;
    const countryCode = addr.country?.trim()?.toUpperCase() || undefined;

    const fullAddress = [line1, line2, district, city, postalCode, countryCode]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      shippingFullName: fullName,
      shippingPhone: phone,
      shippingLine1: line1,
      shippingLine2: line2,
      shippingDistrict: district,
      shippingCity: city,
      shippingPostalCode: postalCode,
      shippingCountryCode: countryCode,
      shippingAddress: fullAddress || undefined,
    };
  }

  /**
   * Maps a WooCommerce Raw Order into KroptOS MarketplaceOrder.
   */
  static toMarketplaceOrder(order: WooCommerceRawOrder): MarketplaceOrder | null {
    const normalizedStatus = this.mapOrderStatus(order.status);
    if (!normalizedStatus) {
      // Skipped order (draft/trash)
      return null;
    }

    const carrierAddr = this.extractCarrierAddress(order);
    const customerName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() ||
      carrierAddr.shippingFullName ||
      'Müşteri';

    const items: MarketplaceOrderItem[] = (order.line_items || []).map((item) => {
      const unitPrice = item.price !== undefined ? this.parseAmount(item.price) : this.parseAmount(item.total) / Math.max(1, Number(item.quantity) || 1);
      const totalPrice = this.parseAmount(item.total);
      const sku = item.sku?.trim() || String(item.variation_id || item.product_id || item.id);

      return {
        sku,
        name: item.name || 'Ürün',
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: Math.round(unitPrice * 100) / 100,
        totalPrice,
      };
    });

    return {
      orderNumber: String(order.number || order.id),
      marketplaceOrderNumber: String(order.id),
      customerName,
      customerEmail: order.billing?.email || undefined,
      customerPhone: order.billing?.phone || carrierAddr.shippingPhone || undefined,
      status: normalizedStatus,
      paymentStatus: this.mapPaymentStatus(order),
      totalAmount: this.parseAmount(order.total),
      currency: String(order.currency || 'TRY').toUpperCase(),
      source: 'woocommerce',
      shippingAddress: carrierAddr.shippingAddress,
      shippingFullName: carrierAddr.shippingFullName,
      shippingPhone: carrierAddr.shippingPhone,
      shippingLine1: carrierAddr.shippingLine1,
      shippingLine2: carrierAddr.shippingLine2,
      shippingDistrict: carrierAddr.shippingDistrict,
      shippingCity: carrierAddr.shippingCity,
      shippingPostalCode: carrierAddr.shippingPostalCode,
      shippingCountryCode: carrierAddr.shippingCountryCode,
      items,
    };
  }

  /**
   * Maps a simple product or variation to MarketplaceProduct.
   */
  static toMarketplaceProduct(
    product: WooCommerceRawProduct,
    variation?: WooCommerceProductVariation,
  ): MarketplaceProduct {
    if (variation) {
      const sku = variation.sku?.trim() || `${product.sku || product.id}_var_${variation.id}`;
      const price = variation.price ? this.parseAmount(variation.price) : this.parseAmount(variation.regular_price);
      const stock = typeof variation.stock_quantity === 'number' ? variation.stock_quantity : (variation.stock_status === 'instock' ? 999 : 0);

      return {
        sku,
        name: `${product.name} - ${variation.attributes?.map((a) => a.option).join(' ') || variation.id}`,
        price,
        stockQuantity: stock,
        barcode: sku,
      };
    }

    const sku = product.sku?.trim() || String(product.id);
    const price = product.price ? this.parseAmount(product.price) : this.parseAmount(product.regular_price);
    const stock = typeof product.stock_quantity === 'number' ? product.stock_quantity : (product.stock_status === 'instock' ? 999 : 0);

    return {
      sku,
      name: product.name,
      price,
      stockQuantity: stock,
      barcode: sku,
    };
  }
}
