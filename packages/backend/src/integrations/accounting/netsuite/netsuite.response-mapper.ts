import { AccountingInvoiceResult } from '../core/AccountingTypes';

export class NetSuiteResponseMapper {
  /**
   * NetSuite fatura cevabını standart KroptOS sonucuna dönüştürür.
   */
  static toInvoiceResult(rawResponse: any, fallbackExternalId?: string): AccountingInvoiceResult {
    const id = rawResponse?.id ? String(rawResponse.id) : String(fallbackExternalId || '');
    const number = rawResponse?.tranId || rawResponse?.otherRefNum || id;

    return {
      externalId: id,
      externalNumber: String(number),
      rawResponse,
    };
  }

  /**
   * NetSuite cari cevabından iç kimliği çıkarır.
   */
  static toCustomerId(rawResponse: any): string {
    return String(rawResponse?.id || '');
  }

  /**
   * NetSuite tahsilat cevabından iç kimliği çıkarır.
   */
  static toPaymentId(rawResponse: any): string {
    return String(rawResponse?.id || '');
  }
}
