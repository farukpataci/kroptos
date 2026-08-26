import { buyerKey, buyerMatches, groupBuyers, BuyerSourceOrder } from './buyers';

const order = (o: Partial<BuyerSourceOrder>): BuyerSourceOrder => ({
  customerName: 'Ayşe Yılmaz',
  totalAmount: '100.00',
  currency: 'TRY',
  createdAt: '2026-08-01T10:00:00.000Z',
  ...o,
});

describe('buyerKey', () => {
  it('prefers email, then phone, then name', () => {
    expect(buyerKey(order({ customerEmail: 'a@b.com', customerPhone: '5551112233' }))).toBe(
      'email:a@b.com',
    );
    expect(buyerKey(order({ customerPhone: '5551112233' }))).toBe('phone:5551112233');
    expect(buyerKey(order({ customerName: 'Ayşe Yılmaz' }))).toBe('name:ayşe yılmaz');
  });

  it('ignores case and padding on email so one buyer is not two', () => {
    expect(buyerKey(order({ customerEmail: '  A@B.com ' }))).toBe(
      buyerKey(order({ customerEmail: 'a@b.com' })),
    );
  });

  it('compares the last ten digits, so channel phone formats agree', () => {
    const forms = ['+90 555 111 22 33', '0555 111 22 33', '5551112233', '90-555-111-22-33'];
    const keys = new Set(forms.map((customerPhone) => buyerKey(order({ customerPhone }))));
    expect(keys).toEqual(new Set(['phone:5551112233']));
  });
});

describe('groupBuyers', () => {
  it('counts orders and sums money per buyer', () => {
    const [buyer] = groupBuyers([
      order({ customerEmail: 'a@b.com', totalAmount: '100.50' }),
      order({ customerEmail: 'a@b.com', totalAmount: 49.5 }),
    ]);
    expect(buyer.orderCount).toBe(2);
    expect(buyer.totalsByCurrency).toEqual({ TRY: 150 });
  });

  it('keeps currencies apart instead of adding them together', () => {
    const [buyer] = groupBuyers([
      order({ customerEmail: 'a@b.com', totalAmount: 100, currency: 'TRY' }),
      order({ customerEmail: 'a@b.com', totalAmount: 20, currency: 'USD' }),
    ]);
    expect(buyer.totalsByCurrency).toEqual({ TRY: 100, USD: 20 });
  });

  it('reports the newest order date and the newest spelling of the name', () => {
    const [buyer] = groupBuyers([
      order({
        customerEmail: 'a@b.com',
        customerName: 'AYSE YILMAZ',
        createdAt: '2026-08-01T00:00:00.000Z',
      }),
      order({
        customerEmail: 'a@b.com',
        customerName: 'Ayşe Yılmaz',
        createdAt: '2026-08-20T00:00:00.000Z',
      }),
    ]);
    expect(buyer.lastOrderAt).toBe('2026-08-20T00:00:00.000Z');
    expect(buyer.name).toBe('Ayşe Yılmaz');
  });

  it('fills in contact details a later order supplied', () => {
    const [buyer] = groupBuyers([
      order({ customerPhone: '5551112233' }),
      order({ customerPhone: '5551112233', customerEmail: 'a@b.com' }),
    ]);
    expect(buyer.email).toBe('a@b.com');
    expect(buyer.phone).toBe('5551112233');
  });

  it('does not merge two buyers who share nothing', () => {
    expect(
      groupBuyers([
        order({ customerEmail: 'a@b.com' }),
        order({ customerEmail: 'c@d.com' }),
      ]),
    ).toHaveLength(2);
  });

  it('sorts most recent buyer first', () => {
    const rows = groupBuyers([
      order({ customerEmail: 'old@b.com', createdAt: '2026-01-01T00:00:00.000Z' }),
      order({ customerEmail: 'new@b.com', createdAt: '2026-08-20T00:00:00.000Z' }),
    ]);
    expect(rows.map((r) => r.email)).toEqual(['new@b.com', 'old@b.com']);
  });

  it('survives an empty list', () => {
    expect(groupBuyers([])).toEqual([]);
  });
});

describe('buyerMatches', () => {
  const [buyer] = groupBuyers([
    order({ customerName: 'Ayşe Yılmaz', customerEmail: 'a@b.com', customerPhone: '5551112233' }),
  ]);

  it('searches name, email and phone', () => {
    expect(buyerMatches(buyer, 'yılmaz')).toBe(true);
    expect(buyerMatches(buyer, 'A@B')).toBe(true);
    expect(buyerMatches(buyer, '1112233')).toBe(true);
    expect(buyerMatches(buyer, 'mehmet')).toBe(false);
  });

  it('an empty query matches everyone', () => {
    expect(buyerMatches(buyer, '   ')).toBe(true);
  });
});
