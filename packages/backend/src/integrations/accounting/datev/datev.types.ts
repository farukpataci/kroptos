/**
 * DATEV EXTF Buchungsstapel Type Definitions (§5, §6)
 *
 * Implements DATEV-Format Hauptversion 700, Datenkategorie 21 (Buchungsstapel), Formatversion 13.
 * References: DATEV Hilfe-Center Dok.-Nr. 1036228 & 1003221.
 */

export type DatevKontenrahmen = 'SKR03' | 'SKR04';

export type DatevEncoding = 'WINDOWS-1252' | 'UTF-8';

export type DatevSollHaben = 'S' | 'H';

export interface DatevConfig {
  /** 1001 bis 9999999 */
  beraterNummer: number;
  /** 1 bis 99999 */
  mandantenNummer: number;
  /** Wirtschaftsjahresbeginn (YYYY-MM-DD or YYYYMMDD) */
  wjBeginn: string;
  /** 4 bis 8 (Standard: 4) */
  sachkontenLaenge: number;
  /** SKR03 oder SKR04 (Muss vom Betreiber gewählt werden, kein Default) */
  kontenrahmen: DatevKontenrahmen;
  /** Debitoren-Nummernkreis Beginn (z.B. 10000 bei 4-stelligen Sachkonten) */
  debitorNummernkreisStart?: number;
  /** Debitoren-Nummernkreis Ende (z.B. 69999) */
  debitorNummernkreisEnde?: number;
  /** Standard Erlöskonten je Steuersatz */
  defaultRevenueAccounts?: {
    standard19?: number; // z.B. 8400 (SKR03) / 4400 (SKR04)
    reduced7?: number;   // z.B. 8300 (SKR03) / 4300 (SKR04)
    zero0?: number;      // z.B. 8120 (SKR03) / 4120 (SKR04)
  };
  /** Standard BU-Schlüssel (Steuerautomatik) */
  defaultBuKeys?: {
    standard19?: number;
    reduced7?: number;
  };
  /** Bank-/Kassengegenkonto für Zahlungen (z.B. 1200 / 1800 bei SKR03) */
  bankAccount?: number;
  /** Dateikodierung (Standard: WINDOWS-1252) */
  encoding?: DatevEncoding;
  /** Festschreibung beim Import (0 = keine Festschreibung, 1 = festgeschrieben; Standard: 0) */
  festschreibung?: 0 | 1;
  /** Diktatkürzel des Bearbeiters (max 2 Zeichen, z.B. "KO") */
  diktatKuerzel?: string;
  /** Bezeichnung des Stapels (max 30 Zeichen) */
  bezeichnung?: string;
}

export interface DatevHeaderInput {
  beraterNummer: number;
  mandantenNummer: number;
  wjBeginn: Date | string;
  sachkontenLaenge: number;
  datumVon: Date | string;
  datumBis: Date | string;
  bezeichnung?: string;
  diktatKuerzel?: string;
  festschreibung?: 0 | 1;
  wkz?: string; // Standard: 'EUR'
  kontenrahmen?: DatevKontenrahmen;
  erzeugtAm?: Date;
}

export interface DatevBookingEntry {
  /** Umsatz/Betrag (Immer positiv, Dezimalzahl) */
  umsatz: number;
  /** Soll/Haben-Kennzeichen ('S' oder 'H') */
  sollHaben: DatevSollHaben;
  /** Währungskennzeichen (Standard: 'EUR') */
  wkzUmsatz?: string;
  kurs?: number;
  basisUmsatz?: number;
  wkzBasisUmsatz?: string;
  /** Konto (Sachkonto oder Personenkonto) */
  konto: number;
  /** Gegenkonto (ohne BU-Schlüssel) */
  gegenkonto: number;
  /** BU-Schlüssel (Steuer-/Berichtigungsschlüssel) */
  buSchluessel?: number | string;
  /** Belegdatum (Date Objekt oder YYYY-MM-DD; wird im Satz als TTMM formatiert) */
  belegdatum: Date | string;
  /** Belegfeld 1 (Rechnungsnummer, max 36 Zeichen, nur a-zA-Z0-9$&%*+-\/) */
  belegfeld1?: string;
  /** Belegfeld 2 (Fälligkeit/Zusatz, max 12 Zeichen) */
  belegfeld2?: string;
  skonto?: number;
  /** Buchungstext (max 60 Zeichen) */
  buchungstext?: string;
  postensperre?: boolean | number;
  diverseAdressnummer?: string;
  geschaeftspartnerbank?: number;
  sachverhalt?: number;
  zinssperre?: boolean | number;
  beleglink?: string;
  kost1Kostenstelle?: string;
  kost2Kostenstelle?: string;
  kostMenge?: number;
  euLandUstId?: string;
  euSteuersatz?: number;
  abweichendeVersteuerungsart?: string;
  auftragsnummer?: string;
  buchungstyp?: string;
  sepaMandatsreferenz?: string;
  festschreibung?: 0 | 1;
  leistungsdatum?: Date | string;
  datumZuord?: Date | string;
  faelligkeit?: Date | string;
  generalumkehr?: string;
  steuersatz?: number;
  land?: string;
}

export interface DatevExportResult {
  batchId: string;
  fileName: string;
  fileBuffer: Buffer;
  hashSha256: string;
  encoding: DatevEncoding;
  datumVon: string;
  datumBis: string;
  totalDebit: number;
  totalCredit: number;
  entryCount: number;
  orderIds: string[];
  reexportedOrderIds?: string[];
  createdAt: string;
}

export interface DatevExportOptions {
  companyId: string;
  dateFrom: string; // ISO date YYYY-MM-DD
  dateTo: string;   // ISO date YYYY-MM-DD
  acknowledgeReexport?: boolean;
  overrideConfig?: Partial<DatevConfig>;
}

export interface DatevInvoiceItemInput {
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  vatAmount?: number;
  totalAmount: number; // Gross or net (used for line calculation)
}

export interface DatevInvoiceInput {
  id?: string;
  orderId: string;
  invoiceNumber?: string;
  issueDate: string | Date;
  dueDate?: string | Date;
  currency?: string;
  customerId?: string;
  customerNumber?: string | number;
  customerName?: string;
  isCreditNote?: boolean;
  items: DatevInvoiceItemInput[];
  grandTotal: number;
  notes?: string;
}

export interface DatevPaymentInput {
  id?: string;
  paymentId: string;
  orderId?: string;
  invoiceNumber?: string;
  paymentDate: string | Date;
  amount: number;
  currency?: string;
  customerId?: string;
  customerNumber?: string | number;
  paymentMethod?: string;
  notes?: string;
}

