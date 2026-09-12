import {
  EcommerceAddress,
  EcommerceCustomer,
  EcommerceOrder,
  EcommerceOrderItem,
  EcommerceProduct,
  EcommerceProductVariant,
} from '../core/EcommerceTypes';
import { ShopifyOrder, ShopifyProduct, ShopifyAddress, ShopifyCustomer } from './ShopifyTypes';
import { ShopifyStatusMap } from './ShopifyStatusMap';

export class ShopifyMapper {
  /**
   * Parses monetary values from Shopify strings (e.g. "49.99" -> 49.99).
   */
  static parseAmount(value: string | number | undefined | null): number {
    if (value === undefined || value === null || value === '') return 0;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  }

  /**
   * Maps Shopify address to unified EcommerceAddress.
   */
  static toEcommerceAddress(addr?: ShopifyAddress | null): EcommerceAddress | undefined {
    if (!addr) return undefined;
    return {
      firstName: addr.first_name,
      lastName: addr.last_name,
      fullName: addr.name || `${addr.first_name || ''} ${addr.last_name || ''}`.trim() || undefined,
      company: addr.company,
      address1: addr.address1 || '',
      address2: addr.address2,
      city: addr.city || '',
      province: addr.province,
      postalCode: addr.zip,
      country: addr.country || '',
      countryCode: addr.country_code,
      phone: addr.phone,
    };
  }

  /**
   * Maps Shopify customer to unified EcommerceCustomer.
   */
  static toEcommerceCustomer(cust?: ShopifyCustomer | null): EcommerceCustomer | undefined {
    if (!cust) return undefined;
    return {
      id: String(cust.id),
      firstName: cust.first_name,
      lastName: cust.last_name,
      fullName: `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || undefined,
      email: cust.email,
      phone: cust.phone,
    };
  }

  /**
   * Transforms raw ShopifyOrder into normalized EcommerceOrder.
   */
  static toEcommerceOrder(raw: ShopifyOrder): EcommerceOrder {
    const items: EcommerceOrderItem[] = (raw.line_items || []).map((item) => {
      const unitPrice = this.parseAmount(item.price);
      const quantity = Number(item.quantity) || 1;
      const discount = this.parseAmount(item.total_discount);
      return {
        id: String(item.id),
        productId: item.product_id ? String(item.product_id) : undefined,
        variantId: item.variant_id ? String(item.variant_id) : undefined,
        sku: item.sku || undefined,
        title: item.title,
        variantTitle: item.variant_title || undefined,
        quantity,
        unitPrice,
        totalPrice: this.parseAmount(unitPrice * quantity - discount),
        currency: String(raw.currency || 'USD').toUpperCase(),
        discountAmount: discount,
        weightGrams: item.grams,
        requiresShipping: item.requires_shipping,
      };
    });

    return {
      id: String(raw.id),
      orderNumber: String(raw.order_number || raw.name || raw.id),
      provider: 'SHOPIFY',
      createdAt: new Date(raw.created_at),
      updatedAt: new Date(raw.updated_at),
      orderStatus: ShopifyStatusMap.mapOrderStatus(raw.cancelled_at, raw.closed_at),
      financialStatus: ShopifyStatusMap.mapFinancialStatus(raw.financial_status),
      fulfillmentStatus: ShopifyStatusMap.mapFulfillmentStatus(raw.fulfillment_status),
      currency: String(raw.currency || 'USD').toUpperCase(),
      totalPrice: this.parseAmount(raw.total_price),
      subtotalPrice: this.parseAmount(raw.subtotal_price),
      totalTax: this.parseAmount(raw.total_tax),
      totalShipping: 0,
      totalDiscounts: this.parseAmount(raw.total_discounts),
      customer: this.toEcommerceCustomer(raw.customer),
      shippingAddress: this.toEcommerceAddress(raw.shipping_address),
      billingAddress: this.toEcommerceAddress(raw.billing_address),
      items,
      notes: raw.note,
      tags: raw.tags ? raw.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      rawPayload: raw as unknown as Record<string, unknown>,
    };
  }

  /**
   * Transforms raw ShopifyProduct into normalized EcommerceProduct.
   */
  static toEcommerceProduct(raw: ShopifyProduct): EcommerceProduct {
    const variants: EcommerceProductVariant[] = (raw.variants || []).map((v) => ({
      id: String(v.id),
      productId: String(v.product_id || raw.id),
      sku: v.sku || undefined,
      barcode: v.barcode || undefined,
      title: v.title,
      price: this.parseAmount(v.price),
      currency: 'USD',
      inventoryQuantity: typeof v.inventory_quantity === 'number' ? v.inventory_quantity : 0,
      weightGrams: v.weight,
      requiresShipping: v.requires_shipping,
    }));

    return {
      id: String(raw.id),
      provider: 'SHOPIFY',
      title: raw.title,
      description: raw.body_html,
      vendor: raw.vendor,
      productType: raw.product_type,
      status: raw.status || 'active',
      variants,
      images: (raw.images || []).map((img) => img.src),
      tags: raw.tags ? raw.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      createdAt: new Date(raw.created_at),
      updatedAt: new Date(raw.updated_at),
      rawPayload: raw as unknown as Record<string, unknown>,
    };
  }

  /**
   * Masks Personally Identifiable Information (PII) before logging.
   */
  static maskPii(order: ShopifyOrder): Partial<ShopifyOrder> {
    return {
      id: order.id,
      order_number: order.order_number,
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      total_price: order.total_price,
      currency: order.currency,
      email: order.email ? order.email.replace(/(?<=.{2}).(?=[^@]*?@)/g, '*') : undefined,
    };
  }
}
