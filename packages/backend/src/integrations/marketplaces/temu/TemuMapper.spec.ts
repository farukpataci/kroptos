import { TemuMapper } from './TemuMapper';

/**
 * The mapper is not reachable from any connector method today: every Temu
 * operation refuses because no RPC name is confirmed. It is kept — and tested
 * directly — because it encodes a decision that would otherwise have to be
 * rediscovered: Temu states money in minor units, so amounts are divided by
 * 100. Getting that backwards inflates every order a hundredfold, silently.
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
