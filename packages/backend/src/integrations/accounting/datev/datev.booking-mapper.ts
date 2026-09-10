import {
  DatevBookingEntry,
  DatevConfig,
  DatevInvoiceInput,
  DatevPaymentInput,
  DatevSollHaben,
} from './datev.types';
import { DatevAccountResolver } from './datev.account-resolver';
import { DATEV_BELEGFELD1_REGEX } from './datev.validation';

export class DatevBookingMapper {
  /**
   * Sanitizes Belegfeld 1 to conform strictly to DATEV Dok.-Nr. 1036228:
   * Only a-z, A-Z, 0-9 as well as $, &, %, *, +, -, /
   * Max 36 characters.
   */
  static sanitizeBelegfeld1(raw?: string): string {
    if (!raw) return 'BELEG';

    // Replace illegal characters (spaces, dots, commas, underscores, umlauts) with hyphen
    let sanitized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .replace(/[^a-zA-Z0-9$&%*+\-/]/g, '-')
      .replace(/-+/g, '-') // collapse consecutive dashes
      .replace(/^-|-$/g, ''); // trim leading/trailing dashes

    if (!sanitized) {
      sanitized = 'BELEG';
    }

    if (sanitized.length > 36) {
      sanitized = sanitized.substring(0, 36);
    }

    // Safety fallback
    if (!DATEV_BELEGFELD1_REGEX.test(sanitized)) {
      sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '').substring(0, 36) || 'BELEG';
    }

    return sanitized;
  }

  /**
   * Sanitizes Buchungstext to max 60 characters without breaking formatting.
   */
  static sanitizeBuchungstext(raw?: string): string {
    if (!raw) return '';
    return raw.replace(/[\r\n\t]+/g, ' ').trim().substring(0, 60);
  }

  /**
   * Maps a Sales Invoice / Credit Note into DATEV Buchungssätze (§5.3, §5.4, §6.2)
   */
  static mapInvoice(invoice: DatevInvoiceInput, config: DatevConfig): DatevBookingEntry[] {
    const debitorNumber = DatevAccountResolver.resolveDebitorNumber({
      customerId: invoice.customerId,
      externalCustomerNumber: invoice.customerNumber,
      sachkontenLaenge: config.sachkontenLaenge,
      rangeStart: config.debitorNummernkreisStart,
      rangeEnd: config.debitorNummernkreisEnde,
    });

    const belegfeld1 = this.sanitizeBelegfeld1(invoice.invoiceNumber || invoice.orderId);
    const isCreditNote = Boolean(invoice.isCreditNote || invoice.grandTotal < 0);
    const festschreibung = config.festschreibung ?? 0;
    const currency = invoice.currency || 'EUR';

    // Group items by VAT rate if line items exist
    const items = invoice.items || [];
    if (items.length === 0) {
      // Single booking line fallback
      const umsatz = Math.abs(Math.round(invoice.grandTotal * 100) / 100);
      const sollHaben: DatevSollHaben = isCreditNote ? 'S' : 'H';
      const konto = DatevAccountResolver.getRevenueAccount(
        config.kontenrahmen,
        19,
        config.sachkontenLaenge,
        config.defaultRevenueAccounts,
      );

      return [
        {
          umsatz,
          sollHaben,
          wkzUmsatz: currency,
          konto,
          gegenkonto: debitorNumber,
          buSchluessel: DatevAccountResolver.getBuKey(19, config.defaultBuKeys),
          belegdatum: invoice.issueDate,
          belegfeld1,
          buchungstext: this.sanitizeBuchungstext(
            invoice.customerName
              ? `${invoice.customerName} - ${belegfeld1}`
              : `Rechnung ${belegfeld1}`,
          ),
          festschreibung,
        },
      ];
    }

    // Bucket items by tax rate (rounded to whole percentage for grouping)
    const buckets = new Map<number, number>();
    for (const item of items) {
      const rate = Math.round(item.vatRate || 0);
      const lineTotal = item.totalAmount !== undefined && item.totalAmount !== null
        ? item.totalAmount
        : item.quantity * item.unitPrice + (item.vatAmount || 0);

      const current = buckets.get(rate) || 0;
      buckets.set(rate, current + lineTotal);
    }

    const entries: DatevBookingEntry[] = [];

    for (const [vatRate, bucketAmount] of buckets.entries()) {
      const umsatz = Math.abs(Math.round(bucketAmount * 100) / 100);
      if (umsatz === 0) continue;

      const sollHaben: DatevSollHaben = isCreditNote ? 'S' : 'H';
      const konto = DatevAccountResolver.getRevenueAccount(
        config.kontenrahmen,
        vatRate,
        config.sachkontenLaenge,
        config.defaultRevenueAccounts,
      );
      const buSchluessel = DatevAccountResolver.getBuKey(vatRate, config.defaultBuKeys);

      entries.push({
        umsatz,
        sollHaben,
        wkzUmsatz: currency,
        konto,
        gegenkonto: debitorNumber,
        buSchluessel,
        belegdatum: invoice.issueDate,
        belegfeld1,
        buchungstext: this.sanitizeBuchungstext(
          invoice.customerName
            ? `${invoice.customerName} (${vatRate}%)`
            : `Rechnung ${belegfeld1} (${vatRate}%)`,
        ),
        festschreibung,
      });
    }

    return entries;
  }

  /**
   * Maps a customer payment into a DATEV Buchungssatz (§5.3, §6.1)
   */
  static mapPayment(payment: DatevPaymentInput, config: DatevConfig): DatevBookingEntry {
    const debitorNumber = DatevAccountResolver.resolveDebitorNumber({
      customerId: payment.customerId,
      externalCustomerNumber: payment.customerNumber,
      sachkontenLaenge: config.sachkontenLaenge,
      rangeStart: config.debitorNummernkreisStart,
      rangeEnd: config.debitorNummernkreisEnde,
    });

    const bankAccount = DatevAccountResolver.getBankAccount(
      config.kontenrahmen,
      config.sachkontenLaenge,
      config.bankAccount,
    );

    const belegfeld1 = this.sanitizeBelegfeld1(
      payment.invoiceNumber || payment.orderId || payment.paymentId,
    );

    const isNegative = payment.amount < 0;
    const umsatz = Math.abs(Math.round(payment.amount * 100) / 100);
    // Regular payment: Soll Bank, Haben Debitor -> sollHaben 'S' on Bankkonto
    // Refund/chargeback: Haben Bank, Soll Debitor -> sollHaben 'H' on Bankkonto
    const sollHaben: DatevSollHaben = isNegative ? 'H' : 'S';

    return {
      umsatz,
      sollHaben,
      wkzUmsatz: payment.currency || 'EUR',
      konto: bankAccount,
      gegenkonto: debitorNumber,
      belegdatum: payment.paymentDate,
      belegfeld1,
      buchungstext: this.sanitizeBuchungstext(payment.notes || `Zahlung ${belegfeld1}`),
      festschreibung: config.festschreibung ?? 0,
    };
  }

  /**
   * Maps full batch of invoices and payments, ordered chronologically by Belegdatum
   */
  static mapBatch(
    invoices: DatevInvoiceInput[],
    payments: DatevPaymentInput[],
    config: DatevConfig,
  ): DatevBookingEntry[] {
    const entries: DatevBookingEntry[] = [];

    for (const inv of invoices) {
      entries.push(...this.mapInvoice(inv, config));
    }

    for (const pay of payments) {
      entries.push(this.mapPayment(pay, config));
    }

    // Sort by Belegdatum ascending
    entries.sort((a, b) => {
      const timeA = new Date(a.belegdatum).getTime();
      const timeB = new Date(b.belegdatum).getTime();
      return timeA - timeB;
    });

    return entries;
  }
}
