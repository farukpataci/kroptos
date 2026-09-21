import {
  CatalogField,
  ConditionOperator,
} from '../automation-types';

export const FIELD_CATALOG: CatalogField[] = [
  {
    key: 'source',
    labelKey: 'fields.source',
    type: 'string',
    operators: ['eq', 'neq', 'in', 'not_in'],
    options: [
      { value: 'trendyol', labelKey: 'sources.trendyol' },
      { value: 'hepsiburada', labelKey: 'sources.hepsiburada' },
      { value: 'ciceksepeti', labelKey: 'sources.ciceksepeti' },
      { value: 'pazarama', labelKey: 'sources.pazarama' },
      { value: 'n11', labelKey: 'sources.n11' },
      { value: 'shopify', labelKey: 'sources.shopify' },
      { value: 'manual', labelKey: 'sources.manual' },
    ],
  },
  {
    key: 'status',
    labelKey: 'fields.status',
    type: 'enum',
    operators: ['eq', 'neq', 'in', 'not_in'],
    options: [
      { value: 'pending', labelKey: 'orderStatus.pending' },
      { value: 'processing', labelKey: 'orderStatus.processing' },
      { value: 'shipped', labelKey: 'orderStatus.shipped' },
      { value: 'delivered', labelKey: 'orderStatus.delivered' },
      { value: 'cancelled', labelKey: 'orderStatus.cancelled' },
    ],
  },
  {
    key: 'paymentStatus',
    labelKey: 'fields.paymentStatus',
    type: 'enum',
    operators: ['eq', 'neq', 'in', 'not_in'],
    options: [
      { value: 'pending', labelKey: 'paymentStatus.pending' },
      { value: 'paid', labelKey: 'paymentStatus.paid' },
      { value: 'partially_refunded', labelKey: 'paymentStatus.partially_refunded' },
      { value: 'refunded', labelKey: 'paymentStatus.refunded' },
      { value: 'failed', labelKey: 'paymentStatus.failed' },
    ],
  },
  {
    key: 'fulfillmentStatus',
    labelKey: 'fields.fulfillmentStatus',
    type: 'enum',
    operators: ['eq', 'neq', 'in', 'not_in'],
    options: [
      { value: 'unfulfilled', labelKey: 'fulfillmentStatus.unfulfilled' },
      { value: 'partially_fulfilled', labelKey: 'fulfillmentStatus.partially_fulfilled' },
      { value: 'fulfilled', labelKey: 'fulfillmentStatus.fulfilled' },
      { value: 'returned', labelKey: 'fulfillmentStatus.returned' },
    ],
  },
  {
    key: 'totalAmount',
    labelKey: 'fields.totalAmount',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  },
  {
    key: 'currency',
    labelKey: 'fields.currency',
    type: 'string',
    operators: ['eq', 'neq', 'in', 'not_in'],
    options: [
      { value: 'TRY', labelKey: 'currencies.TRY' },
      { value: 'USD', labelKey: 'currencies.USD' },
      { value: 'EUR', labelKey: 'currencies.EUR' },
    ],
  },
  {
    key: 'itemCount',
    labelKey: 'fields.itemCount',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  },
  {
    key: 'totalDesi',
    labelKey: 'fields.totalDesi',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  },
  {
    key: 'shippingCity',
    labelKey: 'fields.shippingCity',
    type: 'string',
    operators: ['eq', 'neq', 'in', 'not_in', 'contains'],
  },
  {
    key: 'shippingDistrict',
    labelKey: 'fields.shippingDistrict',
    type: 'string',
    operators: ['eq', 'neq', 'in', 'not_in', 'contains'],
  },
  {
    key: 'shippingCountry',
    labelKey: 'fields.shippingCountry',
    type: 'string',
    operators: ['eq', 'neq', 'in', 'not_in'],
  },
  {
    key: 'hasSku',
    labelKey: 'fields.hasSku',
    type: 'string',
    operators: ['eq', 'contains', 'in'],
  },
  {
    key: 'tags',
    labelKey: 'fields.tags',
    type: 'array',
    operators: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  },
  {
    key: 'isHold',
    labelKey: 'fields.isHold',
    type: 'boolean',
    operators: ['eq', 'neq'],
  },
  {
    key: 'priority',
    labelKey: 'fields.priority',
    type: 'string',
    operators: ['eq', 'neq', 'in', 'not_in'],
    options: [
      { value: 'urgent', labelKey: 'priorities.urgent' },
      { value: 'high', labelKey: 'priorities.high' },
      { value: 'normal', labelKey: 'priorities.normal' },
      { value: 'low', labelKey: 'priorities.low' },
    ],
  },
  {
    key: 'notes',
    labelKey: 'fields.notes',
    type: 'string',
    operators: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  },
  {
    key: 'isFirstOrder',
    labelKey: 'fields.isFirstOrder',
    type: 'boolean',
    operators: ['eq'],
  },
  {
    key: 'orderHour',
    labelKey: 'fields.orderHour',
    type: 'number',
    operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
  },
  {
    key: 'orderDayOfWeek',
    labelKey: 'fields.orderDayOfWeek',
    type: 'number',
    operators: ['eq', 'in', 'not_in'],
    options: [
      { value: '1', labelKey: 'days.monday' },
      { value: '2', labelKey: 'days.tuesday' },
      { value: '3', labelKey: 'days.wednesday' },
      { value: '4', labelKey: 'days.thursday' },
      { value: '5', labelKey: 'days.friday' },
      { value: '6', labelKey: 'days.saturday' },
      { value: '7', labelKey: 'days.sunday' },
    ],
  },
];

/**
 * Resolves a field value dynamically from the loaded Order entity.
 */
export function extractFieldValue(order: any, field: string): any {
  if (!order) return undefined;

  switch (field) {
    case 'source':
      return order.source?.toLowerCase();

    case 'status':
      return order.status?.toLowerCase();

    case 'paymentStatus':
      return order.paymentStatus?.toLowerCase();

    case 'fulfillmentStatus':
      return order.fulfillmentStatus?.toLowerCase();

    case 'totalAmount':
      return Number(order.totalAmount);

    case 'currency':
      return order.currency?.toUpperCase();

    case 'itemCount':
      if (Array.isArray(order.items)) {
        return order.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
      }
      return 0;

    case 'totalDesi':
      if (Array.isArray(order.items)) {
        return order.items.reduce((sum: number, it: any) => {
          const qty = Number(it.quantity) || 1;
          const product = it.product;
          if (product && product.width && product.height && product.depth) {
            const desi = (Number(product.width) * Number(product.height) * Number(product.depth)) / 3000;
            return sum + desi * qty;
          }
          return sum;
        }, 0);
      }
      return 0;

    case 'shippingCity':
      return (order.shippingCity || '').trim();

    case 'shippingDistrict':
      return (order.shippingDistrict || '').trim();

    case 'shippingCountry':
      return (order.shippingCountryCode || '').trim();

    case 'hasSku':
      if (Array.isArray(order.items)) {
        return order.items.map((it: any) => it.sku?.toLowerCase());
      }
      return [];

    case 'tags':
      return Array.isArray(order.tags) ? order.tags : [];

    case 'isHold':
      return !!order.isHold;

    case 'priority':
      return order.priority || 'normal';

    case 'notes':
      return order.notes || '';

    case 'isFirstOrder':
      return !!order._isFirstOrder;

    case 'orderHour':
      if (order.createdAt) {
        return new Date(order.createdAt).getHours();
      }
      return 0;

    case 'orderDayOfWeek':
      if (order.createdAt) {
        const day = new Date(order.createdAt).getDay();
        return day === 0 ? 7 : day; // 1 (Mon) - 7 (Sun)
      }
      return 1;

    default:
      return order[field];
  }
}

/**
 * Evaluates a binary or unary condition operator between actual and expected values.
 */
export function evaluateOperator(
  actual: any,
  operator: ConditionOperator,
  expected: any,
): boolean {
  switch (operator) {
    case 'eq':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.trim().toLowerCase() === expected.trim().toLowerCase();
      }
      if (typeof actual === 'number' && typeof expected === 'number') {
        return Math.abs(actual - expected) < 0.00001;
      }
      return actual === expected;

    case 'neq':
      return !evaluateOperator(actual, 'eq', expected);

    case 'gt':
      return Number(actual) > Number(expected);

    case 'gte':
      return Number(actual) >= Number(expected);

    case 'lt':
      return Number(actual) < Number(expected);

    case 'lte':
      return Number(actual) <= Number(expected);

    case 'between': {
      const min = Number(Array.isArray(expected) ? expected[0] : expected?.min);
      const max = Number(Array.isArray(expected) ? expected[1] : expected?.max);
      const val = Number(actual);
      return val >= min && val <= max;
    }

    case 'in': {
      const list = Array.isArray(expected)
        ? expected
        : typeof expected === 'string'
          ? expected.split(',').map((s) => s.trim())
          : [expected];
      const strList = list.map((v: any) => String(v).toLowerCase().trim());
      if (Array.isArray(actual)) {
        return actual.some((a) => strList.includes(String(a).toLowerCase().trim()));
      }
      return strList.includes(String(actual).toLowerCase().trim());
    }

    case 'not_in':
      return !evaluateOperator(actual, 'in', expected);

    case 'contains':
      if (Array.isArray(actual)) {
        const expStr = String(expected).toLowerCase().trim();
        return actual.some((item) => String(item).toLowerCase().trim().includes(expStr));
      }
      if (typeof actual === 'string') {
        return actual.toLowerCase().includes(String(expected).toLowerCase().trim());
      }
      return false;

    case 'not_contains':
      return !evaluateOperator(actual, 'contains', expected);

    case 'is_empty':
      if (actual === null || actual === undefined) return true;
      if (typeof actual === 'string') return actual.trim().length === 0;
      if (Array.isArray(actual)) return actual.length === 0;
      return false;

    case 'is_not_empty':
      return !evaluateOperator(actual, 'is_empty', expected);

    default:
      return false;
  }
}
