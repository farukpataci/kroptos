import {
  DatevBookingEntry,
  DatevEncoding,
  DatevHeaderInput,
} from './datev.types';
import { DatevHeaderBuilder } from './datev.header';
import { DatevEncodingService } from './datev.encoding';

/**
 * Official DATEV-Format 700 / 21 Column Headers (125 Columns according to Dok.-Nr. 1036228 / 1003221)
 */
export const DATEV_COLUMNS: string[] = [
  'Umsatz (ohne Soll/Haben-Kz)',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basisumsatz',
  'WKZ Basisumsatz',
  'Konto',
  'Gegenkonto (ohne BU-Schlüssel)',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Belegfeld 2',
  'Skonto',
  'Buchungstext',
  'Postensperre',
  'Diverse Adressnummer',
  'Geschäftspartnerbank',
  'Sachverhalt',
  'Zinssperre',
  'Beleglink',
  'Beleginfo – Art 1',
  'Beleginfo – Inhalt 1',
  'Beleginfo – Art 2',
  'Beleginfo – Inhalt 2',
  'Beleginfo – Art 3',
  'Beleginfo – Inhalt 3',
  'Beleginfo – Art 4',
  'Beleginfo – Inhalt 4',
  'Beleginfo – Art 5',
  'Beleginfo – Inhalt 5',
  'Beleginfo – Art 6',
  'Beleginfo – Inhalt 6',
  'Beleginfo – Art 7',
  'Beleginfo – Inhalt 7',
  'Beleginfo – Art 8',
  'Beleginfo – Inhalt 8',
  'KOST1 – Kostenstelle',
  'KOST2 – Kostenstelle',
  'Kost Menge',
  'EU-Land u. USt-IdNr.',
  'EU-Steuersatz',
  'Abw. Versteuerungsart',
  'Sachverhalt L+L',
  'Funktionsergänzung L+L',
  'BU 49 Hauptfunktionstyp',
  'BU 49 Hauptfunktionsnummer',
  'BU 49 Funktionsergänzung',
  'Zusatzinformation – Art 1',
  'Zusatzinformation – Inhalt 1',
  'Zusatzinformation – Art 2',
  'Zusatzinformation – Inhalt 2',
  'Zusatzinformation – Art 3',
  'Zusatzinformation – Inhalt 3',
  'Zusatzinformation – Art 4',
  'Zusatzinformation – Inhalt 4',
  'Zusatzinformation – Art 5',
  'Zusatzinformation – Inhalt 5',
  'Zusatzinformation – Art 6',
  'Zusatzinformation – Inhalt 6',
  'Zusatzinformation – Art 7',
  'Zusatzinformation – Inhalt 7',
  'Zusatzinformation – Art 8',
  'Zusatzinformation – Inhalt 8',
  'Zusatzinformation – Art 9',
  'Zusatzinformation – Inhalt 9',
  'Zusatzinformation – Art 10',
  'Zusatzinformation – Inhalt 10',
  'Zusatzinformation – Art 11',
  'Zusatzinformation – Inhalt 11',
  'Zusatzinformation – Art 12',
  'Zusatzinformation – Inhalt 12',
  'Zusatzinformation – Art 13',
  'Zusatzinformation – Inhalt 13',
  'Zusatzinformation – Art 14',
  'Zusatzinformation – Inhalt 14',
  'Zusatzinformation – Art 15',
  'Zusatzinformation – Inhalt 15',
  'Zusatzinformation – Art 16',
  'Zusatzinformation – Inhalt 16',
  'Zusatzinformation – Art 17',
  'Zusatzinformation – Inhalt 17',
  'Zusatzinformation – Art 18',
  'Zusatzinformation – Inhalt 18',
  'Zusatzinformation – Art 19',
  'Zusatzinformation – Inhalt 19',
  'Zusatzinformation – Art 20',
  'Zusatzinformation – Inhalt 20',
  'Stück',
  'Gewicht',
  'Zahlweise',
  'Forderungsart',
  'Veranlagungsjahr',
  'Zugeordnete Fälligkeit',
  'Skontotyp',
  'Auftragsnummer',
  'Buchungstyp',
  'USt-Schlüssel (Anzahlungen)',
  'EU-Mitgliedstaat (Anzahlungen)',
  'Sachverhalt L+L (Anzahlungen)',
  'EU-Steuersatz (Anzahlungen)',
  'Erlöskonto (Anzahlungen)',
  'Herkunft-Kz',
  'Leerfeld',
  'KOST-Datum',
  'SEPA-Mandatsreferenz',
  'Skontosperre',
  'Gesellschaftername',
  'Beteiligtennummer',
  'Identifikationsnummer',
  'Zeichnernummer',
  'Postensperre bis',
  'Bezeichnung',
  'Kennzeichen',
  'Festschreibung',
  'Leistungsdatum',
  'Datum Zuord.',
  'Fälligkeit',
  'Generalumkehr',
  'Steuersatz',
  'Land',
  'Abrechnungsreferent',
  'BVV-Position',
  'EU-Mitgliedstaat u. UStID (Ursprung)',
  'EU-Steuersatz (Ursprung)',
  'Abw. Skontokonto',
];

export interface WriteDatevExtfParams {
  header: DatevHeaderInput;
  entries: DatevBookingEntry[];
  encoding?: DatevEncoding;
}

export class DatevExtfWriter {
  /**
   * Generates EXTF buffer along with debit/credit totals and entry count
   */
  static generateBuchungsstapel(params: WriteDatevExtfParams): {
    buffer: Buffer;
    totalDebit: number;
    totalCredit: number;
    entryCount: number;
  } {
    const buffer = this.write(params);
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of params.entries) {
      if (entry.sollHaben === 'S') {
        totalDebit += entry.umsatz;
      } else {
        totalCredit += entry.umsatz;
      }
    }
    return {
      buffer,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      entryCount: params.entries.length,
    };
  }

  /**
   * Pure function: Girdi -> Byte Dizisi (Buffer)
   * No network, no side effects, no hidden dependencies.
   */
  static write(params: WriteDatevExtfParams): Buffer {
    const encoding = params.encoding || 'WINDOWS-1252';
    const lines: string[] = [];

    // 1. Kopfzeile
    const headerLine = DatevHeaderBuilder.buildHeader(params.header);
    lines.push(headerLine);

    // 2. Spaltenüberschriften
    lines.push(DATEV_COLUMNS.join(';'));

    // 3. Buchungssätze
    for (let index = 0; index < params.entries.length; index++) {
      const entry = params.entries[index];
      const rowLine = this.formatEntryRow(entry, index + 1);
      lines.push(rowLine);
    }

    // DATEV expects Windows CRLF line endings
    const fullCsv = lines.join('\r\n') + '\r\n';

    return DatevEncodingService.encode(fullCsv, encoding, 'EXTF-BATCH');
  }

  private static formatEntryRow(entry: DatevBookingEntry, rowNumber: number): string {
    const rowValues = new Array(DATEV_COLUMNS.length).fill('');

    const formatDecimal = (val?: number | null): string => {
      if (val === undefined || val === null || isNaN(val)) return '';
      // German comma decimal separator (always 2 decimals for monetary values)
      return Math.abs(val).toFixed(2).replace('.', ',');
    };

    const formatRate = (val?: number | null): string => {
      if (val === undefined || val === null || isNaN(val)) return '';
      return val.toFixed(2).replace('.', ',');
    };

    const formatText = (val?: string | null): string => {
      if (val === undefined || val === null || val === '') return '';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const formatBelegdatum = (d: Date | string): string => {
      if (typeof d === 'string') {
        const cleaned = d.replace(/[-]/g, '');
        if (cleaned.length === 4) return cleaned; // Already TTMM
        if (cleaned.length === 8) {
          // YYYYMMDD -> TTMM
          const mm = cleaned.substring(4, 6);
          const dd = cleaned.substring(6, 8);
          return `${dd}${mm}`;
        }
        d = new Date(d);
      }
      const dd = d.getUTCDate().toString().padStart(2, '0');
      const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      return `${dd}${mm}`;
    };

    const formatDateYYYYMMDD = (d?: Date | string | null): string => {
      if (!d) return '';
      if (typeof d === 'string') {
        const cleaned = d.replace(/[-]/g, '');
        if (cleaned.length === 8) return cleaned;
        d = new Date(d);
      }
      const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
      const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      const dd = d.getUTCDate().toString().padStart(2, '0');
      return `${yyyy}${mm}${dd}`;
    };

    // 1. Umsatz (ohne Soll/Haben-Kz) - Immer positiv
    rowValues[0] = formatDecimal(entry.umsatz);

    // 2. Soll/Haben-Kennzeichen - 'S' atau 'H'
    rowValues[1] = entry.sollHaben;

    // 3. WKZ Umsatz (Standard: EUR)
    rowValues[2] = entry.wkzUmsatz ? formatText(entry.wkzUmsatz) : '';

    // 4. Kurs
    if (entry.kurs) rowValues[3] = formatDecimal(entry.kurs);

    // 5. Basisumsatz
    if (entry.basisUmsatz) rowValues[4] = formatDecimal(entry.basisUmsatz);

    // 6. WKZ Basisumsatz
    if (entry.wkzBasisUmsatz) rowValues[5] = formatText(entry.wkzBasisUmsatz);

    // 7. Konto (Sach- oder Personenkonto)
    rowValues[6] = String(entry.konto);

    // 8. Gegenkonto (ohne BU-Schlüssel)
    rowValues[7] = String(entry.gegenkonto);

    // 9. BU-Schlüssel
    if (entry.buSchluessel !== undefined && entry.buSchluessel !== null && entry.buSchluessel !== '') {
      rowValues[8] = String(entry.buSchluessel);
    }

    // 10. Belegdatum (TTMM)
    rowValues[9] = formatBelegdatum(entry.belegdatum);

    // 11. Belegfeld 1 (Rechnungsnummer, max 36 Zeichen)
    if (entry.belegfeld1) rowValues[10] = formatText(entry.belegfeld1);

    // 12. Belegfeld 2
    if (entry.belegfeld2) rowValues[11] = formatText(entry.belegfeld2);

    // 13. Skonto
    if (entry.skonto) rowValues[12] = formatDecimal(entry.skonto);

    // 14. Buchungstext (max 60 Zeichen)
    if (entry.buchungstext) rowValues[13] = formatText(entry.buchungstext.substring(0, 60));

    // 15. Postensperre
    if (entry.postensperre !== undefined) rowValues[14] = entry.postensperre ? '1' : '0';

    // 16. Diverse Adressnummer
    if (entry.diverseAdressnummer) rowValues[15] = formatText(entry.diverseAdressnummer);

    // 17. Geschäftspartnerbank
    if (entry.geschaeftspartnerbank !== undefined) rowValues[16] = String(entry.geschaeftspartnerbank);

    // 18. Sachverhalt
    if (entry.sachverhalt !== undefined) rowValues[17] = String(entry.sachverhalt);

    // 19. Zinssperre
    if (entry.zinssperre !== undefined) rowValues[18] = entry.zinssperre ? '1' : '0';

    // 20. Beleglink
    if (entry.beleglink) rowValues[19] = formatText(entry.beleglink);

    // 37. KOST1 – Kostenstelle
    if (entry.kost1Kostenstelle) rowValues[36] = formatText(entry.kost1Kostenstelle);

    // 38. KOST2 – Kostenstelle
    if (entry.kost2Kostenstelle) rowValues[37] = formatText(entry.kost2Kostenstelle);

    // 39. Kost Menge
    if (entry.kostMenge) rowValues[38] = formatDecimal(entry.kostMenge);

    // 40. EU-Land u. USt-IdNr.
    if (entry.euLandUstId) rowValues[39] = formatText(entry.euLandUstId);

    // 41. EU-Steuersatz
    if (entry.euSteuersatz) rowValues[40] = formatRate(entry.euSteuersatz);

    // 42. Abw. Versteuerungsart
    if (entry.abweichendeVersteuerungsart) rowValues[41] = formatText(entry.abweichendeVersteuerungsart);

    // 95. Auftragsnummer
    if (entry.auftragsnummer) rowValues[94] = formatText(entry.auftragsnummer);

    // 96. Buchungstyp
    if (entry.buchungstyp) rowValues[95] = formatText(entry.buchungstyp);

    // 105. SEPA-Mandatsreferenz
    if (entry.sepaMandatsreferenz) rowValues[104] = formatText(entry.sepaMandatsreferenz);

    // 114. Festschreibung (0 = keine Festschreibung)
    rowValues[113] = entry.festschreibung !== undefined ? String(entry.festschreibung) : '0';

    // 115. Leistungsdatum
    if (entry.leistungsdatum) rowValues[114] = formatDateYYYYMMDD(entry.leistungsdatum);

    // 116. Datum Zuord.
    if (entry.datumZuord) rowValues[115] = formatDateYYYYMMDD(entry.datumZuord);

    // 117. Fälligkeit
    if (entry.faelligkeit) rowValues[116] = formatDateYYYYMMDD(entry.faelligkeit);

    // 118. Generalumkehr
    if (entry.generalumkehr) rowValues[117] = formatText(entry.generalumkehr);

    // 119. Steuersatz
    if (entry.steuersatz) rowValues[118] = formatRate(entry.steuersatz);

    // 120. Land
    if (entry.land) rowValues[119] = formatText(entry.land);

    return rowValues.join(';');
  }
}
