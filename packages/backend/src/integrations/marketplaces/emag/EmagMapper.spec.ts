import {
  EMAG_COUNTRY_CONTEXT,
  EmagMapper,
  EmagUnresolvedSkuError,
  parseEmagDateParts,
  parseEmagDateToUtc,
} from './EmagMapper';
import { RawEmagOrder, RawEmagProduct } from './EmagTypes';

const RO = EMAG_COUNTRY_CONTEXT.RO;

function baseOrder(overrides: Partial<RawEmagOrder> = {}): RawEmagOrder {
  return {
    id: 1001,
    status: 1,
    payment_mode_id: 1,
    shipping_tax: 10,
    date: '2014-07-24 12:16:47',
    customer: {
      id: 5,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone_1: '0700000000',
      shipping_street: 'Str. Exemplu 1',
      shipping_city: 'Bucuresti',
      shipping_suburb: 'Sector 1',
      shipping_postal_code: '010101',
      shipping_country: 'RO',
    },
    products: [
      { id: 1, product_id: 55, part_number: 'SKU-1', name: 'Widget', quantity: 2, sale_price: 100, vat: 0.19 },
    ],
    ...overrides,
  };
}

describe('EmagMapper.toUnifiedOrder — status mapping (six codes)', () => {
  const cases: Array<[number, string]> = [
    [0, 'cancelled'],
    [1, 'pending'],
    [2, 'processing'],
    [3, 'processing'],
    [4, 'shipped'],
    [5, 'returned'], // iade; iptale indirgenmiyor — bkz. mapper yorumu
  ];

  it.each(cases)('maps status %i to %s', (status, expected) => {
    const order = baseOrder({ status: status as RawEmagOrder['status'] });
    expect(EmagMapper.toUnifiedOrder(order, RO).order.status).toBe(expected);
  });
});

describe('EmagMapper.toUnifiedOrder — payment status', () => {
  it('COD (payment_mode_id=1) is always pending', () => {
    const order = baseOrder({ payment_mode_id: 1 });
    expect(EmagMapper.toUnifiedOrder(order, RO).order.paymentStatus).toBe('pending');
  });

  it('bank transfer (payment_mode_id=2) is always pending', () => {
    const order = baseOrder({ payment_mode_id: 2 });
    expect(EmagMapper.toUnifiedOrder(order, RO).order.paymentStatus).toBe('pending');
  });

  it('online card (payment_mode_id=3) is paid only when payment_status=1', () => {
    const paid = baseOrder({ payment_mode_id: 3, payment_status: 1 });
    const unpaid = baseOrder({ payment_mode_id: 3, payment_status: 0 });

    expect(EmagMapper.toUnifiedOrder(paid, RO).order.paymentStatus).toBe('paid');
    expect(EmagMapper.toUnifiedOrder(unpaid, RO).order.paymentStatus).toBe('pending');
  });
});

describe('EmagMapper.toUnifiedOrder — shipping address', () => {
  it('joins street, city, suburb, postal code, country in that order', () => {
    const order = baseOrder();
    expect(EmagMapper.toUnifiedOrder(order, RO).order.shippingAddress).toBe(
      'Str. Exemplu 1, Bucuresti, Sector 1, 010101, RO',
    );
  });

  it('skips blank parts rather than leaving stray separators', () => {
    const order = baseOrder({
      customer: {
        ...baseOrder().customer,
        shipping_suburb: undefined,
        shipping_postal_code: '',
      },
    });
    expect(EmagMapper.toUnifiedOrder(order, RO).order.shippingAddress).toBe('Str. Exemplu 1, Bucuresti, RO');
  });

  it('never includes shipping_locality_id, a numeric internal reference', () => {
    const order = baseOrder({
      customer: { ...baseOrder().customer, shipping_locality_id: 12345 },
    });
    expect(EmagMapper.toUnifiedOrder(order, RO).order.shippingAddress).not.toContain('12345');
  });
});

describe('EmagMapper.toUnifiedOrder — customer email', () => {
  it('treats an empty string email as undefined', () => {
    const order = baseOrder({ customer: { ...baseOrder().customer, email: '' } });
    expect(EmagMapper.toUnifiedOrder(order, RO).order.customerEmail).toBeUndefined();
  });

  it('passes through a real email', () => {
    const order = baseOrder();
    expect(EmagMapper.toUnifiedOrder(order, RO).order.customerEmail).toBe('ada@example.com');
  });
});

describe('EmagMapper.toUnifiedOrder — total amount (VAT included)', () => {
  it('sums line (sale_price * quantity * (1 + vat)) plus shipping_tax', () => {
    // 100 * 2 * 1.19 = 238, + shipping_tax 10 = 248
    const order = baseOrder();
    expect(EmagMapper.toUnifiedOrder(order, RO).order.totalAmount).toBeCloseTo(248);
  });

  it('sums multiple lines with different vat rates', () => {
    const order = baseOrder({
      products: [
        { id: 1, product_id: 55, part_number: 'SKU-1', name: 'A', quantity: 1, sale_price: 100, vat: 0.19 },
        { id: 2, product_id: 56, part_number: 'SKU-2', name: 'B', quantity: 3, sale_price: 50, vat: 0.09 },
      ],
      shipping_tax: 0,
    });
    // 100*1*1.19 = 119, 50*3*1.09 = 163.5 -> 282.5
    expect(EmagMapper.toUnifiedOrder(order, RO).order.totalAmount).toBeCloseTo(282.5);
  });
});

describe('EmagMapper.toUnifiedOrder — currency and source', () => {
  it('takes currency from the market context, never leaving it blank', () => {
    expect(EmagMapper.toUnifiedOrder(baseOrder(), RO).order.currency).toBe('RON');
    expect(EmagMapper.toUnifiedOrder(baseOrder(), EMAG_COUNTRY_CONTEXT.PL).order.currency).toBe('PLN');
  });

  it('always tags the order source as emag', () => {
    expect(EmagMapper.toUnifiedOrder(baseOrder(), RO).order.source).toBe('emag');
  });

  it('does not prefix orderNumber; leaves that to the connector', () => {
    expect(EmagMapper.toUnifiedOrder(baseOrder(), RO).order.orderNumber).toBe('1001');
  });
});

describe('EmagMapper.toUnifiedOrder — blank part_number line', () => {
  it('recovers via product_id lookup and records a warning', () => {
    const order = baseOrder({
      products: [
        { id: 9, product_id: 55, part_number: '', name: 'Widget', quantity: 1, sale_price: 100, vat: 0.19 },
      ],
    });
    const lookup = new Map<number, string>([[55, 'RECOVERED-SKU']]);

    const result = EmagMapper.toUnifiedOrder(order, RO, lookup);

    expect(result.order.items[0].sku).toBe('RECOVERED-SKU');
    expect(result.skuWarnings).toHaveLength(1);
    expect(result.skuWarnings[0]).toContain('product_id=55');
  });

  it('throws EmagUnresolvedSkuError when neither part_number nor product_id resolve', () => {
    const order = baseOrder({
      products: [
        { id: 9, product_id: 999, part_number: '', name: 'Widget', quantity: 1, sale_price: 100, vat: 0.19 },
      ],
    });

    expect(() => EmagMapper.toUnifiedOrder(order, RO, new Map())).toThrow(EmagUnresolvedSkuError);
  });

  it('does not treat whitespace-only part_number as valid', () => {
    const order = baseOrder({
      products: [
        { id: 9, product_id: 999, part_number: '   ', name: 'Widget', quantity: 1, sale_price: 100, vat: 0.19 },
      ],
    });

    expect(() => EmagMapper.toUnifiedOrder(order, RO, new Map())).toThrow(EmagUnresolvedSkuError);
  });
});

describe('EmagMapper.toUnifiedProduct', () => {
  function baseProduct(overrides: Partial<RawEmagProduct> = {}): RawEmagProduct {
    return {
      id: 1,
      part_number: 'MY-SKU-1',
      part_number_key: 'CATALOG-KEY-1',
      name: 'Widget',
      description: '<p>Bold widget</p>',
      brand: 'Acme',
      category_id: 10,
      sale_price: 42.5,
      recommended_price: 50,
      min_sale_price: 40,
      max_sale_price: 60,
      best_offer_sale_price: 42.5,
      currency: 'RON',
      general_stock: 15,
      estimated_stock: 12,
      weight: 1,
      warranty: 24,
      url: 'https://example.com/widget',
      status: 1,
      images: [],
      characteristics: [],
      ean: [],
      vat_id: 1,
      ownership: 1,
      offer_validation_status: undefined,
      doc_errors: undefined,
      stock: [],
      handling_time: undefined,
      ...overrides,
    };
  }

  it('uses part_number as sku, not id or part_number_key', () => {
    expect(EmagMapper.toUnifiedProduct(baseProduct()).sku).toBe('MY-SKU-1');
  });

  it('does not sanitize HTML in the description', () => {
    expect(EmagMapper.toUnifiedProduct(baseProduct()).description).toBe('<p>Bold widget</p>');
  });

  it('uses sale_price (VAT excluded) directly as price', () => {
    expect(EmagMapper.toUnifiedProduct(baseProduct()).price).toBe(42.5);
  });

  it('uses general_stock, not a sum of stock[]', () => {
    const product = baseProduct({
      general_stock: 15,
      stock: [
        { warehouse_id: 1, value: 100 },
        { warehouse_id: 2, value: 200 },
      ],
    });
    expect(EmagMapper.toUnifiedProduct(product).stockQuantity).toBe(15);
  });

  it('prefers the display_type=1 image as the main image', () => {
    const product = baseProduct({
      images: [
        { display_type: 2, url: 'https://img/secondary.jpg' },
        { display_type: 1, url: 'https://img/main.jpg' },
        { display_type: 0, url: 'https://img/other.jpg' },
      ],
    });
    expect(EmagMapper.toUnifiedProduct(product).image).toBe('https://img/main.jpg');
  });

  it('falls back to the first image when no display_type=1 exists', () => {
    const product = baseProduct({
      images: [
        { display_type: 2, url: 'https://img/secondary.jpg' },
        { display_type: 0, url: 'https://img/other.jpg' },
      ],
    });
    expect(EmagMapper.toUnifiedProduct(product).image).toBe('https://img/secondary.jpg');
  });

  it('leaves image undefined when the image array is empty', () => {
    expect(EmagMapper.toUnifiedProduct(baseProduct({ images: [] })).image).toBeUndefined();
  });

  it('leaves barcode undefined when ean is empty', () => {
    expect(EmagMapper.toUnifiedProduct(baseProduct({ ean: [] })).barcode).toBeUndefined();
  });

  it('uses the first ean entry as barcode', () => {
    expect(EmagMapper.toUnifiedProduct(baseProduct({ ean: ['1234567890123', '999'] })).barcode).toBe(
      '1234567890123',
    );
  });
});

describe('eMAG date parsing', () => {
  it('parses Y-m-d H:i:s parts without using new Date(string)', () => {
    expect(parseEmagDateParts('2014-07-24 12:16:47')).toEqual({
      year: 2014,
      month: 7,
      day: 24,
      hour: 12,
      minute: 16,
      second: 47,
    });
  });

  it('rejects an ISO-formatted string (no T separator accepted)', () => {
    expect(parseEmagDateParts('2014-07-24T12:16:47Z')).toBeUndefined();
  });

  it('rejects garbage input without throwing', () => {
    expect(parseEmagDateParts('not-a-date')).toBeUndefined();
  });

  it('converts a market-local wall clock time to the correct UTC instant', () => {
    // Romania in July is EEST (UTC+3, DST). 12:16:47 local -> 09:16:47 UTC.
    const utc = parseEmagDateToUtc('2014-07-24 12:16:47', 'Europe/Bucharest');
    expect(utc?.toISOString()).toBe('2014-07-24T09:16:47.000Z');
  });
});
