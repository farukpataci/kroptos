import { DatevValidator, DATEV_BELEGFELD1_REGEX } from './datev.validation';
import { DatevConfig, DatevHeaderInput, DatevBookingEntry } from './datev.types';

describe('DatevValidator', () => {
  describe('validateConfig (§6.1)', () => {
    const validConfig: DatevConfig = {
      beraterNummer: 1001,
      mandantenNummer: 12345,
      wjBeginn: '2026-01-01',
      sachkontenLaenge: 4,
      kontenrahmen: 'SKR03',
      festschreibung: 0,
      encoding: 'WINDOWS-1252',
    };

    it('returns empty errors for a completely valid config', () => {
      expect(DatevValidator.validateConfig(validConfig)).toEqual([]);
    });

    it('returns error when config is null or undefined', () => {
      const errors = DatevValidator.validateConfig(null);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('mali müşavirinizden (Steuerberater)');
    });

    it('validates beraterNummer range (1001 - 9999999)', () => {
      const errLow = DatevValidator.validateConfig({ ...validConfig, beraterNummer: 1000 });
      expect(errLow.some(e => e.includes('Berater-Nr'))).toBe(true);

      const errHigh = DatevValidator.validateConfig({ ...validConfig, beraterNummer: 10000000 });
      expect(errHigh.some(e => e.includes('Berater-Nr'))).toBe(true);

      expect(DatevValidator.validateConfig({ ...validConfig, beraterNummer: 9999999 })).toEqual([]);
    });

    it('validates mandantenNummer range (1 - 99999)', () => {
      const errLow = DatevValidator.validateConfig({ ...validConfig, mandantenNummer: 0 });
      expect(errLow.some(e => e.includes('Mandanten-Nr'))).toBe(true);

      const errHigh = DatevValidator.validateConfig({ ...validConfig, mandantenNummer: 100000 });
      expect(errHigh.some(e => e.includes('Mandanten-Nr'))).toBe(true);

      expect(DatevValidator.validateConfig({ ...validConfig, mandantenNummer: 99999 })).toEqual([]);
    });

    it('validates wjBeginn requirement', () => {
      const err = DatevValidator.validateConfig({ ...validConfig, wjBeginn: '' });
      expect(err.some(e => e.includes('Wirtschaftsjahresbeginn'))).toBe(true);
    });

    it('validates sachkontenLaenge range (4 - 8)', () => {
      const err3 = DatevValidator.validateConfig({ ...validConfig, sachkontenLaenge: 3 });
      expect(err3.some(e => e.includes('Sachkontenlänge'))).toBe(true);

      const err9 = DatevValidator.validateConfig({ ...validConfig, sachkontenLaenge: 9 });
      expect(err9.some(e => e.includes('Sachkontenlänge'))).toBe(true);

      expect(DatevValidator.validateConfig({ ...validConfig, sachkontenLaenge: 8 })).toEqual([]);
    });

    it('validates kontenrahmen requirement (must be SKR03 or SKR04, no default)', () => {
      const errMissing = DatevValidator.validateConfig({ ...validConfig, kontenrahmen: undefined as any });
      expect(errMissing.some(e => e.includes('SKR03 veya SKR04'))).toBe(true);

      const errInvalid = DatevValidator.validateConfig({ ...validConfig, kontenrahmen: 'SKR02' as any });
      expect(errInvalid.some(e => e.includes('SKR03 veya SKR04'))).toBe(true);

      expect(DatevValidator.validateConfig({ ...validConfig, kontenrahmen: 'SKR04' })).toEqual([]);
    });
  });

  describe('validateHeader (§5.4)', () => {
    const validHeader: DatevHeaderInput = {
      beraterNummer: 1001,
      mandantenNummer: 12345,
      wjBeginn: '2026-01-01',
      sachkontenLaenge: 4,
      datumVon: '2026-01-01',
      datumBis: '2026-01-31',
      kontenrahmen: 'SKR03',
    };

    it('returns empty errors for a valid header', () => {
      expect(DatevValidator.validateHeader(validHeader)).toEqual([]);
    });

    it('rejects invalid date strings', () => {
      const err = DatevValidator.validateHeader({ ...validHeader, datumVon: 'invalid-date' });
      expect(err.some(e => e.includes('geçersizdir'))).toBe(true);
    });

    it('rejects datumVon > datumBis', () => {
      const err = DatevValidator.validateHeader({
        ...validHeader,
        datumVon: '2026-02-01',
        datumBis: '2026-01-01',
      });
      expect(err.some(e => e.includes('bitiş tarihinden'))).toBe(true);
    });

    it('rejects datumVon before fiscal year start (wjBeginn)', () => {
      const err = DatevValidator.validateHeader({
        ...validHeader,
        wjBeginn: '2026-01-01',
        datumVon: '2025-12-15',
        datumBis: '2025-12-31',
      });
      expect(err.some(e => e.includes('mali yıl başlangıcından'))).toBe(true);
    });
  });

  describe('validateEntries (§5.3, §5.4, §5.5, §4.4)', () => {
    const validEntry: DatevBookingEntry = {
      umsatz: 119.0,
      sollHaben: 'H',
      konto: 8400,
      gegenkonto: 10001,
      belegdatum: '2026-01-15',
      belegfeld1: 'RE-2026-001',
      buchungstext: 'Rechnung RE-2026-001',
    };

    it('returns error when entries list is empty', () => {
      const err = DatevValidator.validateEntries([], 4, '2026-01-01', '2026-01-31');
      expect(err.some(e => e.includes('bulunamadı'))).toBe(true);
    });

    it('accepts valid entries matching sachkontenLaenge and debitorLaenge', () => {
      const err = DatevValidator.validateEntries([validEntry], 4, '2026-01-01', '2026-01-31');
      expect(err).toEqual([]);
    });

    it('rejects zero or negative umsatz (§5.3)', () => {
      const errZero = DatevValidator.validateEntries(
        [{ ...validEntry, umsatz: 0 }],
        4,
        '2026-01-01',
        '2026-01-31',
      );
      expect(errZero.some(e => e.includes('pozitif olmalıdır'))).toBe(true);

      const errNeg = DatevValidator.validateEntries(
        [{ ...validEntry, umsatz: -50.0 }],
        4,
        '2026-01-01',
        '2026-01-31',
      );
      expect(errNeg.some(e => e.includes('pozitif olmalıdır'))).toBe(true);
    });

    it('rejects invalid sollHaben indicator (§5.3)', () => {
      const err = DatevValidator.validateEntries(
        [{ ...validEntry, sollHaben: 'X' as any }],
        4,
        '2026-01-01',
        '2026-01-31',
      );
      expect(err.some(e => e.includes("yalnızca 'S' veya 'H'"))).toBe(true);
    });

    it('rejects accounts with invalid digit length (§5.5)', () => {
      // sachkontenLaenge = 4 -> Sachkonto: 4 digits, Debitor: 5 digits
      // Account with 3 digits or 6 digits is invalid
      const errShort = DatevValidator.validateEntries(
        [{ ...validEntry, konto: 840 }],
        4,
        '2026-01-01',
        '2026-01-31',
      );
      expect(errShort.some(e => e.includes('uyuşmuyor'))).toBe(true);

      const errLong = DatevValidator.validateEntries(
        [{ ...validEntry, gegenkonto: 100000 }],
        4,
        '2026-01-01',
        '2026-01-31',
      );
      expect(errLong.some(e => e.includes('uyuşmuyor'))).toBe(true);
    });

    it('rejects belegdatum outside export date range (§5.4)', () => {
      const err = DatevValidator.validateEntries(
        [{ ...validEntry, belegdatum: '2026-02-05' }],
        4,
        '2026-01-01',
        '2026-01-31',
      );
      expect(err.some(e => e.includes('dönem aralığının'))).toBe(true);
    });

    it('validates Belegfeld 1 character constraints and max length 36 (§4.4)', () => {
      expect(DATEV_BELEGFELD1_REGEX.test('RE-2026-001')).toBe(true);
      expect(DATEV_BELEGFELD1_REGEX.test('INV$123+45/6*&%')).toBe(true);
      expect(DATEV_BELEGFELD1_REGEX.test('RE 2026 001')).toBe(false); // spaces forbidden
      expect(DATEV_BELEGFELD1_REGEX.test('RE.2026.001')).toBe(false); // dot forbidden
      expect(DATEV_BELEGFELD1_REGEX.test('RE,2026,001')).toBe(false); // comma forbidden
      expect(DATEV_BELEGFELD1_REGEX.test('REÜÖÄ')).toBe(false); // umlauts forbidden

      const errChars = DatevValidator.validateEntries(
        [{ ...validEntry, belegfeld1: 'RE 2026 001' }],
        4,
        '2026-01-01',
        '2026-01-31',
      );
      expect(errChars.some(e => e.includes('Belegfeld 1'))).toBe(true);

      const errTooLong = DatevValidator.validateEntries(
        [{ ...validEntry, belegfeld1: 'A'.repeat(37) }],
        4,
        '2026-01-01',
        '2026-01-31',
      );
      expect(errTooLong.some(e => e.includes('azami 36 karakter'))).toBe(true);
    });

    it('validates buchungstext length (max 60 characters)', () => {
      const err = DatevValidator.validateEntries(
        [{ ...validEntry, buchungstext: 'B'.repeat(61) }],
        4,
        '2026-01-01',
        '2026-01-31',
      );
      expect(err.some(e => e.includes('Buchungstext azami 60 karakter'))).toBe(true);
    });
  });
});
