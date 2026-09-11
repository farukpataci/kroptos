import { HttpStatus } from '@nestjs/common';
import { AccountingApiError } from '../core/AccountingErrors';
import { IFortnoxClient } from './fortnox.client';
import { FortnoxFinancialYear } from './fortnox.types';

/**
 * Fortnox Financial Year Validator (§5.6)
 * Before creating or booking an invoice, the invoice date must fall into an active, open financial year.
 * KroptOS never creates financial years automatically — it is a strict bookkeeping configuration
 * that must be managed by the customer/accountant in the Fortnox portal.
 */
export class FortnoxFinancialYearService {
  /**
   * Check if a valid, open financial year exists for the target date.
   * Throws an AccountingApiError if no matching open financial year is found.
   *
   * @param client Fortnox client instance
   * @param dateStr ISO date string (YYYY-MM-DD)
   */
  static async validateFinancialYearForDate(
    client: IFortnoxClient,
    dateStr: string,
  ): Promise<FortnoxFinancialYear> {
    const formattedDate = dateStr.slice(0, 10);
    const years = await client.getFinancialYears(formattedDate);

    if (!years || years.length === 0) {
      throw new AccountingApiError(
        'fortnox',
        HttpStatus.BAD_REQUEST,
        `Fortnox'ta bu tarih (${formattedDate}) için açık bir mali yıl tanımlı değil. Lütfen Fortnox arayüzünden ilgili döneme ait mali yılı açınız.`,
        { date: formattedDate, reason: 'NO_FINANCIAL_YEAR_FOUND' },
      );
    }

    // Find year where date is between FromDate and ToDate and not closed
    const activeYear = years.find((y) => {
      const from = y.FromDate.slice(0, 10);
      const to = y.ToDate.slice(0, 10);
      const isWithinRange = formattedDate >= from && formattedDate <= to;
      const isOpen = !y.Closed;
      return isWithinRange && isOpen;
    });

    if (!activeYear) {
      throw new AccountingApiError(
        'fortnox',
        HttpStatus.BAD_REQUEST,
        `Fortnox'ta bu tarih (${formattedDate}) için tanımlı mali yıl kapalıdır veya aralık dışındadır. Lütfen Fortnox arayüzünden mali yıl durumunu kontrol ediniz.`,
        { date: formattedDate, reason: 'FINANCIAL_YEAR_CLOSED_OR_OUT_OF_RANGE' },
      );
    }

    return activeYear;
  }
}
