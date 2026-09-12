import {
  EcommerceFinancialStatus,
  EcommerceFulfillmentStatus,
  EcommerceOrderStatus,
} from '../core/EcommerceTypes';

/**
 * Maps Shopify's native API status strings into Kropt OS unified domain statuses.
 */
export class ShopifyStatusMap {
  /**
   * Shopify financial_status:
   * 'pending', 'authorized', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'voided'
   */
  static mapFinancialStatus(status?: string | null): EcommerceFinancialStatus {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'paid';
      case 'authorized':
        return 'authorized';
      case 'partially_paid':
        return 'partially_paid';
      case 'refunded':
        return 'refunded';
      case 'partially_refunded':
        return 'partially_refunded';
      case 'voided':
        return 'voided';
      case 'pending':
      default:
        return 'pending';
    }
  }

  /**
   * Shopify fulfillment_status:
   * 'fulfilled', 'partial', 'restocked', or null (unfulfilled)
   */
  static mapFulfillmentStatus(status?: string | null): EcommerceFulfillmentStatus {
    switch (status?.toLowerCase()) {
      case 'fulfilled':
        return 'fulfilled';
      case 'partial':
        return 'partially_fulfilled';
      case 'restocked':
        return 'restocked';
      case null:
      case undefined:
      case 'unfulfilled':
      default:
        return 'unfulfilled';
    }
  }

  /**
   * Derives unified order status from Shopify's timestamps and flags.
   */
  static mapOrderStatus(cancelledAt?: string | null, closedAt?: string | null): EcommerceOrderStatus {
    if (cancelledAt) {
      return 'cancelled';
    }
    if (closedAt) {
      return 'closed';
    }
    return 'open';
  }
}
