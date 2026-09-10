import * as fs from 'fs';
import * as path from 'path';
import { DatevExtfWriter } from './datev.extf-writer';
import { DatevBookingEntry, DatevHeaderInput } from './datev.types';
import { DatevEncodingService } from './datev.encoding';

describe('DatevExtfWriter (§5.1, §9 - Altın Dosya & Saf Fonksiyon)', () => {
  const fixedHeader: DatevHeaderInput = {
    beraterNummer: 12345,
    mandantenNummer: 67890,
    wjBeginn: '2026-01-01',
    sachkontenLaenge: 4,
    datumVon: '2026-01-01',
    datumBis: '2026-01-31',
    bezeichnung: 'KroptOS Test Export',
    diktatKuerzel: 'KO',
    festschreibung: 0,
    wkz: 'EUR',
    kontenrahmen: 'SKR03',
    erzeugtAm: new Date('2026-09-10T12:00:00.000Z'),
  };

  const sampleEntries: DatevBookingEntry[] = [
    {
      umsatz: 119.0,
      sollHaben: 'S',
      konto: 10001,
      gegenkonto: 8400,
      belegdatum: '2026-01-15',
      belegfeld1: 'RE-2026-001',
      buchungstext: 'Müller GmbH - Ausgangsrechnung',
      festschreibung: 0,
    },
    {
      umsatz: 119.0,
      sollHaben: 'S',
      konto: 1200,
      gegenkonto: 10001,
      belegdatum: '2026-01-18',
      belegfeld1: 'RE-2026-001',
      buchungstext: 'Zahlungseingang Müller GmbH',
      festschreibung: 0,
    },
  ];

  it('1. Altın dosya: bilinen girdi kümesi byte düzeyinde altın dosyaya eşittir (§9.1)', () => {
    const generatedBuffer = DatevExtfWriter.write({
      header: fixedHeader,
      entries: sampleEntries,
      encoding: 'WINDOWS-1252',
    });

    const fixturePath = path.join(__dirname, '__fixtures__', 'golden-buchungsstapel.fixture.csv');
    const expectedContent = fs.readFileSync(fixturePath, 'utf8').replace(/\r?\n/g, '\r\n');
    const expectedBuffer = DatevEncodingService.encode(expectedContent, 'WINDOWS-1252');

    expect(DatevEncodingService.decode(generatedBuffer, 'WINDOWS-1252')).toBe(expectedContent);
    expect(generatedBuffer.equals(expectedBuffer)).toBe(true);
  });

  it('2. Umsatz daima pozitif, Soll/Haben-Kennzeichen S veya H olarak ayrılır (§5.3)', () => {
    const entriesWithCredit: DatevBookingEntry[] = [
      {
        umsatz: 50.0,
        sollHaben: 'H',
        konto: 10001,
        gegenkonto: 8400,
        belegdatum: '2026-01-20',
        belegfeld1: 'GS-2026-001',
        buchungstext: 'Gutschrift',
      },
    ];

    const buf = DatevExtfWriter.write({
      header: fixedHeader,
      entries: entriesWithCredit,
      encoding: 'UTF-8',
    });

    const str = buf.toString('utf8');
    const rows = str.split('\r\n');
    // Row 3 is the data row
    const cols = rows[2].split(';');
    expect(cols[0]).toBe('50,00');
    expect(cols[1]).toBe('H');
    expect(cols[0]).not.toContain('-');
  });

  it('3. Saf fonksiyondur: ağ çağrısı, global zaman bağımlılığı veya yan etki içermez (§5.1, §9.13)', () => {
    // Generate twice with identical inputs -> Identical outputs
    const buf1 = DatevExtfWriter.write({
      header: fixedHeader,
      entries: sampleEntries,
    });
    const buf2 = DatevExtfWriter.write({
      header: fixedHeader,
      entries: sampleEntries,
    });

    expect(buf1.equals(buf2)).toBe(true);
  });
});
