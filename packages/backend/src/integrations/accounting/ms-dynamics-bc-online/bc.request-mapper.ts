/**
 * Business Central Request Mapper
 * Source: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/resources/dynamics_salesinvoice
 *
 * CRITICAL RULE (§4.1):
 * Tutarları BİZ hesaplamıyoruz. Salt okunur alanlar (amountIncludingTax, taxPercent,
 * totalAmountIncludingTax, totalTaxAmount, netAmount vb.) ASLA GÖNDERİLMEZ.
 */

import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import {
  BusinessCentralCustomer,
  BusinessCentralItem,
  BusinessCentralSalesInvoiceHeader,
  BusinessCentralSalesInvoiceLine,
} from './bc.types';

export class BusinessCentralRequestMapper {
  /**
   * Maps KroptOS invoice request to Business Central salesInvoice header.
   * Only writable fields are included.
   */
  static toSalesInvoiceHeader(
    request: AccountingInvoiceRequest,
  ): Partial<BusinessCentralSalesInvoiceHeader> {
    const header: Partial<BusinessCentralSalesInvoiceHeader> = {
      externalDocumentNumber: request.referenceCode,
      invoiceDate: request.issueDate,
      postingDate: request.issueDate,
      dueDate: request.dueDate || request.issueDate,
      customerId: request.contact.id || '',
      currencyCode: request.currency === 'TRY' ? '' : request.currency, // Standard BC local currency uses empty code
      customerName: request.contact.name,
      phoneNumber: request.contact.phone,
      email: request.contact.email,
    };

    return header;
  }

  /**
   * Maps KroptOS invoice items to Business Central salesInvoiceLine objects.
   * STRICT: amountIncludingTax, netAmount, taxPercent are NOT sent.
   */
  static toSalesInvoiceLines(
    request: AccountingInvoiceRequest,
    invoiceId: string,
  ): Partial<BusinessCentralSalesInvoiceLine>[] {
    return request.items.map((item, index) => {
      const line: Partial<BusinessCentralSalesInvoiceLine> = {
        documentId: invoiceId,
        sequence: (index + 1) * 10000,
        lineType: 'Item',
        description: item.name.slice(0, 100), // BC standard description length
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };

      if (item.discountAmount && item.discountAmount > 0) {
        line.discountAmount = item.discountAmount;
      }

      if (item.sku) {
        line.lineObjectNumber = item.sku;
      }

      // Note: taxCode is mapped if available, KroptOS vatRate is not directly sent as taxPercent
      if (item.vatRate !== undefined) {
        line.taxCode = `VAT${item.vatRate}`;
      }

      return line;
    });
  }

  /**
   * Maps KroptOS contact request to Business Central Customer object.
   */
  static toCustomer(request: AccountingContactRequest): Partial<BusinessCentralCustomer> {
    return {
      displayName: request.name.slice(0, 100),
      type: request.isCompany ? 'Company' : 'Person',
      email: request.email,
      phoneNumber: request.phone,
      taxRegistrationNumber: request.taxNumber,
      addressLine1: request.address ? request.address.slice(0, 100) : undefined,
      city: request.city,
      country: 'TR',
    };
  }

  /**
   * Maps KroptOS product request to Business Central Item object.
   */
  static toItem(request: AccountingProductRequest): Partial<BusinessCentralItem> {
    return {
      number: request.sku.slice(0, 20),
      displayName: request.name.slice(0, 100),
      type: 'Inventory',
      unitPrice: request.unitPrice,
    };
  }
}
