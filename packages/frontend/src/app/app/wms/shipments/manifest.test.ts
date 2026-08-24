import { manifestHtml, ManifestRow } from './manifest';

const row = (over: Partial<ManifestRow> = {}): ManifestRow => ({
  barcode: 'BC-1',
  trackingNumber: 'TRK-1',
  provider: 'MOCK',
  referenceCode: 'ord-1',
  totalDesi: 2,
  totalWeightKg: 1.5,
  ...over,
});

describe('manifestHtml', () => {
  it('lists every parcel and counts them', () => {
    const html = manifestHtml('2026-08-24T10:00:00Z', [row(), row({ barcode: 'BC-2' })]);

    expect(html).toContain('BC-1');
    expect(html).toContain('BC-2');
    expect(html).toContain('Toplam 2 paket');
  });

  it('leaves a line for both signatures — the sheet is signed, not filed', () => {
    const html = manifestHtml('2026-08-24T10:00:00Z', [row()]);

    expect(html).toContain('Teslim eden');
    expect(html).toContain('Teslim alan kurye');
  });

  it('escapes values instead of letting them close a tag', () => {
    const html = manifestHtml('2026-08-24T10:00:00Z', [row({ barcode: '<script>x</script>' })]);

    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('prints a dash for what a parcel does not carry', () => {
    const html = manifestHtml('2026-08-24T10:00:00Z', [
      row({ trackingNumber: null, totalDesi: null }),
    ]);

    expect(html).toContain('<td class="mono">-</td>');
  });
});
