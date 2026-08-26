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
    // Same key both times — that is the only way the fill-in runs. `buyerKey`
    // prefers email, so two orders merge only when they agree on it.
    const [buyer] = groupBuyers([
      order({ customerEmail: 'a@b.com' }),
      order({ customerEmail: 'a@b.com', customerPhone: '5551112233' }),
    ]);
    expect(buyer.email).toBe('a@b.com');
    expect(buyer.phone).toBe('5551112233');
  });

  /**
   * Documents real behaviour, not desired behaviour.
   *
   * `buyerKey` prefers email, so an order carrying one is keyed by email while
   * the same person's earlier phone-only order is keyed by phone: they are two
   * buyers, and the "keep whichever contact details the buyer eventually
   * supplied" line in groupBuyers can never fill in an email — by the time an
   * email exists the order has already been keyed by it.
   *
   * This test previously asserted the opposite and passed, because the sort
   * comparator was invalid and happened to put the email-keyed row first.
   * Fixing the comparator exposed it. Merging the two is a real change to who
   * counts as one buyer, so it is left as a decision rather than made here.
   */
  it('does not merge a phone-only order with the same buyer once they supply an email', () => {
    const rows = groupBuyers([
      order({ customerPhone: '5551112233' }),
      order({ customerPhone: '5551112233', customerEmail: 'a@b.com' }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.key).sort()).toEqual(['email:a@b.com', 'phone:5551112233']);
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

  /**
   * The comparator used to answer -1 in both directions on a tie, so buyers
   * sharing a timestamp came out in an arbitrary order. A bulk marketplace
   * import writes one createdAt across the batch, so ties are the normal case,
   * not an edge one.
   */
  it('orders buyers sharing a timestamp deterministically', () => {
    const sameInstant = '2026-08-01T10:00:00.000Z';
    const input = [
      order({ customerEmail: 'a@b.com', createdAt: sameInstant }),
      order({ customerEmail: 'b@b.com', createdAt: sameInstant }),
      order({ customerEmail: 'c@b.com', createdAt: sameInstant }),
    ];

    const first = groupBuyers(input).map((r) => r.email);
    const second = groupBuyers(input).map((r) => r.email);

    expect(first).toEqual(second);
    // Stable: the tie keeps the order the buyers were grouped in.
    expect(first).toEqual(['a@b.com', 'b@b.com', 'c@b.com']);
  });

  it('still sorts newest first when the timestamps differ', () => {
    const rows = groupBuyers([
      order({ customerEmail: 'old@b.com', createdAt: '2026-07-01T10:00:00.000Z' }),
      order({ customerEmail: 'new@b.com', createdAt: '2026-08-20T10:00:00.000Z' }),
      order({ customerEmail: 'mid@b.com', createdAt: '2026-08-01T10:00:00.000Z' }),
    ]);

    expect(rows.map((r) => r.email)).toEqual(['new@b.com', 'mid@b.com', 'old@b.com']);
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
