import {
  AccountingContactResult,
  AccountingInvoiceResult,
  AccountingPaymentResult,
  AccountingProductResult,
} from '../core/AccountingTypes';
import {
  KolaybiApiResponse,
  KolaybiContactData,
  KolaybiInvoiceData,
  KolaybiPaymentData,
  KolaybiProductData,
} from './kolaybi.types';

export class KolaybiResponseMapper {
  static toInvoiceResult(response: KolaybiApiResponse<KolaybiInvoiceData>): AccountingInvoiceResult {
    const data = response.data;
    const invoiceId = data?.id || (response as any).id || 'unknown';
    const invoiceNo = data?.invoice_no || (response as any).invoice_no;

    return {
      externalId: String(invoiceId),
      externalNumber: invoiceNo ? String(invoiceNo) : undefined,
      rawResponse: response,
    };
  }

  static toContactResult(response: KolaybiApiResponse<KolaybiContactData>): AccountingContactResult {
    const data = response.data;
    const contactId = data?.id || (response as any).id || 'unknown';

    return {
      externalId: String(contactId),
      rawResponse: response,
    };
  }

  static toPaymentResult(response: KolaybiApiResponse<KolaybiPaymentData>): AccountingPaymentResult {
    const data = response.data;
    const paymentId = data?.id || (response as any).id || 'unknown';

    return {
      externalId: String(paymentId),
      rawResponse: response,
    };
  }

  static toProductResult(response: KolaybiApiResponse<KolaybiProductData>): AccountingProductResult {
    const data = response.data;
    const productId = data?.id || (response as any).id || 'unknown';
    const code = data?.code || (response as any).code;

    return {
      externalId: String(productId),
      code: code ? String(code) : undefined,
      rawResponse: response,
    };
  }
}
