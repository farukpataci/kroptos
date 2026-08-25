import { UnmappedKeyRecorder } from './UnmappedKeys';

describe('UnmappedKeyRecorder', () => {
  it('names what the narrow function never read, and nothing it did', () => {
    const recorder = new UnmappedKeyRecorder('TRENDYOL');
    const raw = {
      orderNumber: '123',
      cargoTrackingNumber: 9876543210,
      shipmentAddress: { city: 'Istanbul', phone: '05550000000' },
    };

    recorder.observe('orders', raw, (row: any) => ({
      orderNumber: row.orderNumber,
      city: row.shipmentAddress.city,
    }));

    const [finding] = recorder.consume();
    expect(finding.provider).toBe('TRENDYOL');
    expect(finding.endpoint).toBe('orders');
    expect(finding.keys).toEqual(['cargoTrackingNumber', 'shipmentAddress.phone']);
  });

  it('carries key names only, never a value', () => {
    const recorder = new UnmappedKeyRecorder('TRENDYOL');
    recorder.observe('orders', { customerPhone: '05551234567', total: 1234.5 }, () => ({}));

    const [finding] = recorder.consume();
    expect(finding.keys).toEqual(['customerPhone', 'total']);
    // The whole finding, serialised, must not contain either value.
    const serialised = JSON.stringify(finding);
    expect(serialised).not.toContain('05551234567');
    expect(serialised).not.toContain('1234.5');
  });

  it('collapses an array onto one path instead of one per element', () => {
    const recorder = new UnmappedKeyRecorder('TRENDYOL');
    const raw = {
      lines: [
        { barcode: 'a', vatRate: 20 },
        { barcode: 'b', vatRate: 20 },
        { barcode: 'c', vatRate: 20 },
      ],
    };

    recorder.observe('orders', raw, (row: any) =>
      row.lines.map((line: any) => ({ barcode: line.barcode })),
    );

    expect(recorder.consume()[0].keys).toEqual(['lines[].vatRate']);
  });

  it('says nothing when the mapping reads everything', () => {
    const recorder = new UnmappedKeyRecorder('TRENDYOL');
    recorder.observe('orders', { a: 1, b: { c: 2 } }, (row: any) => ({ a: row.a, c: row.b.c }));
    expect(recorder.consume()).toEqual([]);
  });

  it('folds a whole page into one finding per endpoint, keys unioned', () => {
    const recorder = new UnmappedKeyRecorder('TRENDYOL');
    const narrow = (row: any) => ({ orderNumber: row.orderNumber });

    // Two hundred rows, and an optional key that only some of them carry — the
    // shape that used to produce a row per variation.
    for (let i = 0; i < 200; i++) {
      recorder.observe(
        'orders',
        i % 4 === 0
          ? { orderNumber: `n${i}`, cargoTrackingNumber: i, cargoTrackingLink: 'x' }
          : { orderNumber: `n${i}`, cargoTrackingNumber: i },
        narrow,
      );
    }
    recorder.observe('products', { stockCode: 'a', vatRate: 20 }, (row: any) => ({ sku: row.stockCode }));

    const findings = recorder.consume();
    expect(findings).toHaveLength(2);
    expect(findings.find((f) => f.endpoint === 'orders')!.keys).toEqual([
      'cargoTrackingLink',
      'cargoTrackingNumber',
    ]);
    expect(findings.find((f) => f.endpoint === 'products')!.keys).toEqual(['vatRate']);
  });

  it('returns what the narrow function returned, unchanged', () => {
    const recorder = new UnmappedKeyRecorder('TRENDYOL');
    const out = recorder.observe('orders', { a: 1, b: 2 }, (row: any) => ({ doubled: row.a * 2 }));
    expect(out).toEqual({ doubled: 2 });
  });

  it('clears on consume, so the same finding cannot be written twice', () => {
    const recorder = new UnmappedKeyRecorder('TRENDYOL');
    recorder.observe('orders', { a: 1 }, () => ({}));
    expect(recorder.consume()).toHaveLength(1);
    expect(recorder.consume()).toEqual([]);
  });
});
