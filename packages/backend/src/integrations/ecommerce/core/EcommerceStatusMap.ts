import {
  EcommerceFinancialStatus,
  EcommerceFulfillmentStatus,
  EcommerceOrderStatus,
} from './EcommerceTypes';

/**
 * Common status normalizer helpers for e-commerce platforms.
 */
export class EcommerceStatusMap {
  static normalizeFinancialStatus(rawStatus?: string): EcommerceFinancialStatus {
    const s = String(rawStatus ?? '').toLowerCase().trim();
    switch (s) {
      case 'paid':
      case 'completed':
      case 'success':
        return 'paid';
      case 'authorized':
        return 'authorized';
      case 'partially_paid':
      case 'partial':
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

  static normalizeFulfillmentStatus(rawStatus?: string): EcommerceFulfillmentStatus {
    const s = String(rawStatus ?? '').toLowerCase().trim();
    switch (s) {
      case 'fulfilled':
      case 'shipped':
      case 'delivered':
        return 'fulfilled';
      case 'partial':
      case 'partially_fulfilled':
        return 'partially_fulfilled';
      case 'restocked':
        return 'restocked';
      case 'cancelled':
        return 'cancelled';
      case 'unfulfilled':
      default:
        return 'unfulfilled';
    }
  }

  static normalizeOrderStatus(rawStatus?: string): EcommerceOrderStatus {
    const s = String(rawStatus ?? '').toLowerCase().trim();
    switch (s) {
      case 'closed':
      case 'completed':
        return 'closed';
      case 'cancelled':
        return 'cancelled';
      case 'archived':
        return 'archived';
      case 'open':
      default:
        return 'open';
    }
  }
}
