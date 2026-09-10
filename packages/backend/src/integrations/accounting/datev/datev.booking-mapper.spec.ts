import { DatevBookingMapper } from './datev.booking-mapper';
import { DatevConfig, DatevInvoiceInput, DatevPaymentInput } from './datev.types';
import { DATEV_BELEGFELD1_REGEX } from './datev.validation';

describe('DatevBookingMapper', () => {
  const baseConfig: DatevConfig = {
    beraterNummer: 1001,
    mandantenNummer: 12345,
    wjBeginn: '2026-01-01',
    sachkontenLaenge: 4,
    kontenrahmen: 'SKR03',
    festschreibung: 0,
    encoding: 'WINDOWS-1252',
  };

  describe('sanitizeBelegfeld1 (§4.4)', () => {
    it('preserves valid alphanumeric and special characters', () => {
      const valid = 'RE-2026/001+A$';
      expect(DatevBookingMapper.sanitizeBelegfeld1(valid)).toBe(valid);
      expect(DATEV_BELEGFELD1_REGEX.test(valid)).toBe(true);
    });

    it('replaces spaces, dots, and unsupported characters with hyphen', () => {
      const raw = 'INV 2026.09.10 #99';
      const sanitized = DatevBookingMapper.sanitizeBelegfeld1(raw);
      expect(DATEV_BELEGFELD1_REGEX.test(sanitized)).toBe(true);
      expect(sanitized).not.toContain(' ');
      expect(sanitized).not.toContain('.');
      expect(sanitized).not.toContain('#');
    });

    it('truncates at 36 characters', () => {
      const veryLong = 'INV-' + 'A'.repeat(50);
      const sanitized = DatevBookingMapper.sanitizeBelegfeld1(veryLong);
      expect(sanitized.length).toBeLessThanOrEqual(36);
      expect(DATEV_BELEGFELD1_REGEX.test(sanitized)).toBe(true);
    });

    it('handles empty or undefined input with fallback', () => {
      expect(DatevBookingMapper.sanitizeBelegfeld1(undefined)).toBe('BELEG');
      expect(DatevBookingMapper.sanitizeBelegfeld1('')).toBe('BELEG');
      expect(DatevBookingMapper.sanitizeBelegfeld1('...')).toBe('BELEG');
    });
  });

  describe('sanitizeBuchungstext', () => {
    it('cleans newlines, tabs, and trims to max 60 characters', () => {
      const raw = '  Müller & Co.\n\tMonatsrechnung   ' + 'X'.repeat(60);
      const cleaned = DatevBookingMapper.sanitizeBuchungstext(raw);
      expect(cleaned.length).toBeLessThanOrEqual(60);
      expect(cleaned).not.toContain('\n');
      expect(cleaned).not.toContain('\t');
    });
  });

  describe('mapInvoice (§5.3, §5.4, §6.2)', () => {
    it('maps single-rate invoice into balanced Haben-Buchung on revenue account with positive amount', () => {
      const invoice: DatevInvoiceInput = {
        orderId: 'ord-001',
        invoiceNumber: 'RE-2026-001',
        issueDate: '2026-01-15',
        grandTotal: 119.0,
        customerNumber: 10005,
        items: [
          {
            name: 'KroptOS Lizenz',
            quantity: 1,
            unitPrice: 100.0,
            vatRate: 19,
            vatAmount: 19.0,
            totalAmount: 119.0,
          },
        ],
      };

      const entries = DatevBookingMapper.mapInvoice(invoice, baseConfig);
      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.umsatz).toBe(119.0);
      expect(entry.sollHaben).toBe('H');
      expect(entry.konto).toBe(8400); // SKR03 19%
      expect(entry.gegenkonto).toBe(10005);
      expect(entry.belegfeld1).toBe('RE-2026-001');
      expect(entry.festschreibung).toBe(0);
    });

    it('splits invoice with multiple tax rates (19% and 7%) into separate Buchungssätze', () => {
      const multiTaxInvoice: DatevInvoiceInput = {
        orderId: 'ord-002',
        invoiceNumber: 'RE-2026-002',
        issueDate: '2026-01-16',
        grandTotal: 226.0,
        customerNumber: 10005,
        items: [
          {
            name: 'Produkt Standard',
            quantity: 1,
            unitPrice: 100.0,
            vatRate: 19,
            vatAmount: 19.0,
            totalAmount: 119.0,
          },
          {
            name: 'Produkt Reduziert',
            quantity: 1,
            unitPrice: 100.0,
            vatRate: 7,
            vatAmount: 7.0,
            totalAmount: 107.0,
          },
        ],
      };

      const entries = DatevBookingMapper.mapInvoice(multiTaxInvoice, baseConfig);
      expect(entries).toHaveLength(2);

      const entry19 = entries.find(e => e.konto === 8400);
      const entry7 = entries.find(e => e.konto === 8300);

      expect(entry19).toBeDefined();
      expect(entry19!.umsatz).toBe(119.0);
      expect(entry19!.sollHaben).toBe('H');

      expect(entry7).toBeDefined();
      expect(entry7!.umsatz).toBe(107.0);
      expect(entry7!.sollHaben).toBe('H');
    });

    it('maps credit note / refund reversing direction with positive amount', () => {
      const creditNote: DatevInvoiceInput = {
        orderId: 'ord-003',
        invoiceNumber: 'GS-2026-001',
        issueDate: '2026-01-18',
        grandTotal: 119.0,
        isCreditNote: true,
        customerNumber: 10005,
        items: [
          {
            name: 'Gutschrift Rücksendung',
            quantity: 1,
            unitPrice: 100.0,
            vatRate: 19,
            vatAmount: 19.0,
            totalAmount: 119.0,
          },
        ],
      };

      const entries = DatevBookingMapper.mapInvoice(creditNote, baseConfig);
      expect(entries).toHaveLength(1);
      expect(entries[0].umsatz).toBe(119.0); // Strictly positive
      expect(entries[0].sollHaben).toBe('S'); // Direction reversed
    });

    it('uses SKR04 accounts when configured', () => {
      const skr04Config: DatevConfig = {
        ...baseConfig,
        kontenrahmen: 'SKR04',
      };

      const invoice: DatevInvoiceInput = {
        orderId: 'ord-004',
        invoiceNumber: 'RE-2026-004',
        issueDate: '2026-01-20',
        grandTotal: 119.0,
        customerNumber: 10005,
        items: [
          {
            name: 'Service',
            quantity: 1,
            unitPrice: 100.0,
            vatRate: 19,
            vatAmount: 19.0,
            totalAmount: 119.0,
          },
        ],
      };

      const entries = DatevBookingMapper.mapInvoice(invoice, skr04Config);
      expect(entries[0].konto).toBe(4400); // SKR04 19%
    });
  });

  describe('mapPayment (§5.3, §6.1)', () => {
    it('maps incoming payment to Soll Bankkonto and Haben Debitor', () => {
      const payment: DatevPaymentInput = {
        paymentId: 'pay-001',
        orderId: 'ord-001',
        invoiceNumber: 'RE-2026-001',
        paymentDate: '2026-01-20',
        amount: 119.0,
        customerNumber: 10005,
      };

      const entry = DatevBookingMapper.mapPayment(payment, baseConfig);
      expect(entry.umsatz).toBe(119.0);
      expect(entry.sollHaben).toBe('S');
      expect(entry.konto).toBe(1200); // Bank SKR03
      expect(entry.gegenkonto).toBe(10005);
      expect(entry.belegfeld1).toBe('RE-2026-001');
    });

    it('maps refund payment reversing direction with positive amount', () => {
      const refund: DatevPaymentInput = {
        paymentId: 'pay-ref-001',
        orderId: 'ord-003',
        paymentDate: '2026-01-22',
        amount: -119.0,
        customerNumber: 10005,
      };

      const entry = DatevBookingMapper.mapPayment(refund, baseConfig);
      expect(entry.umsatz).toBe(119.0);
      expect(entry.sollHaben).toBe('H');
      expect(entry.konto).toBe(1200);
      expect(entry.gegenkonto).toBe(10005);
    });
  });

  describe('mapBatch', () => {
    it('sorts batch entries chronologically by Belegdatum', () => {
      const invoiceLater: DatevInvoiceInput = {
        orderId: 'ord-later',
        issueDate: '2026-01-25',
        grandTotal: 100.0,
        customerNumber: 10001,
        items: [],
      };
      const paymentEarlier: DatevPaymentInput = {
        paymentId: 'pay-earlier',
        paymentDate: '2026-01-10',
        amount: 50.0,
        customerNumber: 10001,
      };

      const batch = DatevBookingMapper.mapBatch([invoiceLater], [paymentEarlier], baseConfig);
      expect(batch).toHaveLength(2);
      expect(batch[0].belegdatum).toBe('2026-01-10');
      expect(batch[1].belegdatum).toBe('2026-01-25');
    });
  });
});
