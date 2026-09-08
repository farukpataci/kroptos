import {
  AccountingContactResult,
  AccountingInvoiceResult,
  AccountingPaymentResult,
  AccountingProductResult,
} from '../core/AccountingTypes';

export class ParasutResponseMapper {
  static toInvoiceResult(response: any): AccountingInvoiceResult {
    const data = response?.data || response;
    return {
      externalId: String(data?.id || ''),
      externalNumber: data?.attributes?.invoice_no || data?.attributes?.number || undefined,
      rawResponse: response,
    };
  }

  static toContactResult(response: any): AccountingContactResult {
    const data = response?.data || response;
    return {
      externalId: String(data?.id || ''),
      rawResponse: response,
    };
  }

  static toPaymentResult(response: any): AccountingPaymentResult {
    const data = response?.data || response;
    return {
      externalId: String(data?.id || ''),
      rawResponse: response,
    };
  }

  static toProductResult(response: any): AccountingProductResult {
    const data = response?.data || response;
    return {
      externalId: String(data?.id || ''),
      code: data?.attributes?.code || undefined,
      rawResponse: response,
    };
  }
}
