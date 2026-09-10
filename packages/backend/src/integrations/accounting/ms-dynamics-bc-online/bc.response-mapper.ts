import {
  AccountingContactResult,
  AccountingInvoiceResult,
  AccountingProductResult,
} from '../core/AccountingTypes';
import {
  BusinessCentralCustomer,
  BusinessCentralItem,
  BusinessCentralSalesInvoiceHeader,
} from './bc.types';

export class BusinessCentralResponseMapper {
  /**
   * Maps Business Central salesInvoice header to AccountingInvoiceResult
   */
  static toInvoiceResult(
    header: BusinessCentralSalesInvoiceHeader,
    extraRaw?: Record<string, any>,
  ): AccountingInvoiceResult {
    return {
      externalId: header.id || '',
      externalNumber: header.number || undefined,
      rawResponse: {
        id: header.id,
        number: header.number,
        externalDocumentNumber: header.externalDocumentNumber,
        providerStatus: header.status || 'Draft',
        totalAmountExcludingTax: header.totalAmountExcludingTax,
        totalTaxAmount: header.totalTaxAmount,
        totalAmountIncludingTax: header.totalAmountIncludingTax,
        lastModifiedDateTime: header.lastModifiedDateTime,
        etag: header['@odata.etag'],
        ...(extraRaw || {}),
      },
    };
  }

  /**
   * Maps Business Central customer to AccountingContactResult
   */
  static toContactResult(customer: BusinessCentralCustomer): AccountingContactResult {
    return {
      externalId: customer.id,
      rawResponse: {
        id: customer.id,
        number: customer.number,
        displayName: customer.displayName,
        email: customer.email,
        taxRegistrationNumber: customer.taxRegistrationNumber,
      },
    };
  }

  /**
   * Maps Business Central item to AccountingProductResult
   */
  static toProductResult(item: BusinessCentralItem): AccountingProductResult {
    return {
      externalId: item.id,
      code: item.number,
      rawResponse: {
        id: item.id,
        number: item.number,
        displayName: item.displayName,
        unitPrice: item.unitPrice,
      },
    };
  }
}
