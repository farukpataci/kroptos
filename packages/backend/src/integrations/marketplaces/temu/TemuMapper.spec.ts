import { TemuMapper } from './TemuMapper';

/**
 * The mapper encodes a decision that would otherwise have to be rediscovered:
 * Temu states money in minor units, so amounts are divided by 100. Getting that
 * backwards inflates every order a hundredfold, silently.
 *
 * DOĞRULANAMADI: the minor-unit assumption itself. The operation names are
 * established but no live response has been read, so this is still the single
 * most damaging thing here to have wrong — which is why it is isolated in one
 * function and tested directly rather than only through the connector.
 *
 * Note the contrast with Zalando, whose mapper reads the same kind of field as
 * a *major* unit. The two live in separate files with different function names
 * precisely so neither can be applied to the other's payload.
 */
describe('TemuMapper.toUnifiedOrder', () => {
  const order = {
    parentOrderSn: 'PO-1',
    orderStatus: 1,
    orderAmount: 2599,
    currency: 'USD',
    receiverName: 'Ada Lovelace',
    addressDetail: '1 Main St',
    city: 'Austin',
    countryCode: 'US',
    itemList: [
      { skuCode: 'SKU-1', goodsName: 'Widget', quantity: 2, unitPrice: 1000, totalAmount: 2000 },
    ],
  };

  describe('amounts', () => {
    it('converts the order total out of minor units', () => {
      expect(TemuMapper.toUnifiedOrder(order, '').totalAmount).toBe(25.99);
    });

    it('converts line prices out of minor units', () => {
      const [item] = TemuMapper.toUnifiedOrder(order, '').items;
      expect(item).toMatchObject({ unitPrice: 10, totalPrice: 20 });
    });

    it('derives a line total from price and quantity when the payload omits it', () => {
      const { totalAmount, ...withoutTotal } = order.itemList[0];
      const mapped = TemuMapper.toUnifiedOrder({ ...order, itemList: [withoutTotal] }, '');

      expect(mapped.items[0].totalPrice).toBe(20);
    });

    it('reports zero for a malformed amount rather than NaN', () => {
      const mapped = TemuMapper.toUnifiedOrder({ ...order, orderAmount: 'abc' as any }, '');
      expect(mapped.totalAmount).toBe(0);
    });
  });

  describe('currency', () => {
    it('uses the currency the payload states', () => {
      expect(TemuMapper.toUnifiedOrder(order, 'TRY').currency).toBe('USD');
    });

    it('does not substitute a guessed currency when the payload omits one', () => {
      const { currency, ...noCurrency } = order;
      expect(TemuMapper.toUnifiedOrder(noCurrency, '').currency).toBe('');
    });
  });

  describe('identifiers and status', () => {
    it('prefers the seller SKU code over Temu own numeric ids', () => {
      expect(TemuMapper.toUnifiedOrder(order, '').items[0].sku).toBe('SKU-1');
    });

    it('falls back to a Temu id when the seller supplied no code', () => {
      const mapped = TemuMapper.toUnifiedOrder(
        { ...order, itemList: [{ skuId: 77, goodsName: 'X', quantity: 1, unitPrice: 100 }] },
        '',
      );
      expect(mapped.items[0].sku).toBe('77');
    });

    it('leaves an unknown status as pending instead of guessing', () => {
      expect(TemuMapper.toUnifiedOrder({ ...order, orderStatus: 99 }, '').status).toBe('pending');
    });

    it('marks a cancelled order as failed payment', () => {
      const mapped = TemuMapper.toUnifiedOrder({ ...order, orderStatus: 5 }, '');
      expect(mapped).toMatchObject({ status: 'cancelled', paymentStatus: 'failed' });
    });

    it('joins the address parts it was given', () => {
      expect(TemuMapper.toUnifiedOrder(order, '').shippingAddress).toBe('1 Main St, Austin, US');
    });

    it('names the source so an imported order says where it came from', () => {
      expect(TemuMapper.toUnifiedOrder(order, '').source).toBe('temu');
    });
  });
});

describe('TemuMapper.toUnifiedProduct', () => {
  const sku = {
    skuId: 9001,
    goodsId: 7001,
    outSkuSn: 'SELLER-SKU-1',
    skuName: 'Widget, blue',
    goodsName: 'Widget',
    salePrice: 2599,
    stockQuantity: 12,
    thumbUrl: 'https://img.example/w.jpg',
  };

  it('prefers the seller\'s own code over Temu\'s numeric ids', () => {
    // Matching inventory happens on the seller's SKU; a numeric Temu id would
    // create a second product nothing can be matched against.
    expect(TemuMapper.toUnifiedProduct(sku).sku).toBe('SELLER-SKU-1');
  });

  it('falls back to a Temu id rather than emitting a blank SKU', () => {
    const { outSkuSn, ...withoutCode } = sku;
    expect(TemuMapper.toUnifiedProduct(withoutCode).sku).toBe('9001');
  });

  it('converts price out of minor units, like orders', () => {
    expect(TemuMapper.toUnifiedProduct(sku).price).toBe(25.99);
  });

  it('prefers the sale price when both are present', () => {
    expect(TemuMapper.toUnifiedProduct({ ...sku, price: 5000 }).price).toBe(25.99);
  });

  it('reports zero stock rather than inventing stock the seller does not have', () => {
    const { stockQuantity, ...withoutStock } = sku;
    expect(TemuMapper.toUnifiedProduct(withoutStock).stockQuantity).toBe(0);
  });

  it('accepts the alternative stock spelling, neither of which is confirmed', () => {
    const { stockQuantity, ...withoutStock } = sku;
    expect(TemuMapper.toUnifiedProduct({ ...withoutStock, quantity: 7 }).stockQuantity).toBe(7);
  });

  it('never leaves a product unnamed', () => {
    const { skuName, goodsName, ...unnamed } = sku;
    expect(TemuMapper.toUnifiedProduct(unnamed).name).toBe('Temu Product');
  });
});
