import { DatevHeaderInput } from './datev.types';

export class DatevHeaderBuilder {
  /**
   * Builds the official DATEV Kopfzeile (Zeile 1) according to Dok.-Nr. 1036228 (Format 700 / 21)
   */
  static buildHeader(input: DatevHeaderInput): string {
    const formatNumber = (val?: number | string | null): string =>
      val !== undefined && val !== null ? String(val) : '';

    const formatText = (val?: string | null): string =>
      val !== undefined && val !== null ? `"${String(val).replace(/"/g, '""')}"` : '""';

    const formatDateYYYYMMDD = (d: Date | string): string => {
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

    const formatTimestamp = (d: Date): string => {
      const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
      const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      const dd = d.getUTCDate().toString().padStart(2, '0');
      const hh = d.getUTCHours().toString().padStart(2, '0');
      const min = d.getUTCMinutes().toString().padStart(2, '0');
      const ss = d.getUTCSeconds().toString().padStart(2, '0');
      const fff = d.getUTCMilliseconds().toString().padStart(3, '0');
      return `${yyyy}${mm}${dd}${hh}${min}${ss}${fff}`;
    };

    const erzeugtAm = input.erzeugtAm || new Date();
    const skrCode =
      input.kontenrahmen === 'SKR04'
        ? '04'
        : input.kontenrahmen === 'SKR03'
        ? '03'
        : '';

    const fields: string[] = [
      '"EXTF"',                                        // 1. DATEV-Format-KZ
      '700',                                           // 2. Versionsnummer (Hauptversion)
      '21',                                            // 3. Datenkategorie (21 = Buchungsstapel)
      '"Buchungsstapel"',                              // 4. Formatname
      '13',                                            // 5. Formatversion (aktuell 13)
      formatTimestamp(erzeugtAm),                      // 6. Erzeugt am (YYYYMMDDHHMMSSFFF)
      '',                                              // 7. Importiert (darf nicht gefüllt werden)
      '"RE"',                                          // 8. Herkunft (RE = Rechnungswesen)
      '"KroptOS"',                                     // 9. Exportiert von
      '',                                              // 10. Importiert von (darf nicht gefüllt werden)
      formatNumber(input.beraterNummer),               // 11. Beraternummer
      formatNumber(input.mandantenNummer),             // 12. Mandantennummer
      formatDateYYYYMMDD(input.wjBeginn),              // 13. WJ-Beginn (YYYYMMDD)
      formatNumber(input.sachkontenLaenge),            // 14. Sachkontenlänge (4-8)
      formatDateYYYYMMDD(input.datumVon),              // 15. Datum vom (YYYYMMDD)
      formatDateYYYYMMDD(input.datumBis),              // 16. Datum bis (YYYYMMDD)
      formatText(input.bezeichnung || 'Buchungsstapel'), // 17. Bezeichnung
      formatText(input.diktatKuerzel || ''),           // 18. Diktatkürzel
      '1',                                             // 19. Buchungstyp (1 = Finanzbuchhaltung)
      '0',                                             // 20. Rechnungslegungszweck (0 = unabhängig)
      input.festschreibung !== undefined ? String(input.festschreibung) : '0', // 21. Festschreibung (0 = keine Festschreibung)
      formatText(input.wkz || 'EUR'),                  // 22. Währungskennzeichen
      '',                                              // 23. reserviert
      '',                                              // 24. Derivatskennzeichen
      '',                                              // 25. reserviert 2
      '',                                              // 26. reserviert 3
      skrCode ? `"${skrCode}"` : '',                   // 27. SKR ("03" oder "04")
      '',                                              // 28. Branchenlösung-Id
      '',                                              // 29. reserviert 4
      '',                                              // 30. reserviert 5
      '',                                              // 31. Anwendungsinformation
    ];

    return fields.join(';');
  }
}
