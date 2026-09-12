import {
  AccountingContactResult,
  AccountingInvoiceResult,
  AccountingProductResult,
} from '../core/AccountingTypes';
import {
  PennylaneCustomerResponse,
  PennylaneInvoiceResponse,
  PennylaneProductResponse,
} from './pennylane.types';

/**
 * Pennylane Yanıt Dönüştürücüsü (§7)
 */
export class PennylaneResponseMapper {
  static toInvoiceResult(
    invoice: PennylaneInvoiceResponse,
    discrepancy = false,
  ): AccountingInvoiceResult {
    return {
      externalId: String(invoice.id),
      externalNumber: invoice.invoice_number || `DRAFT-${invoice.id}`,
      rawResponse: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        draft: invoice.draft,
        status: invoice.status,
        amount: invoice.amount,
        currencyAmount: invoice.currency_amount,
        remainingAmountWithTax: invoice.remaining_amount_with_tax,
        paid: invoice.paid,
        externalReference: invoice.external_reference,
        discrepancy,
      },
    };
  }

  static toContactResult(customer: PennylaneCustomerResponse): AccountingContactResult {
    return {
      externalId: String(customer.id),
      rawResponse: {
        id: customer.id,
        name: customer.name,
        vatNumber: customer.vat_number,
        regNo: customer.reg_no,
        externalReference: customer.external_reference,
      },
    };
  }

  static toProductResult(product: PennylaneProductResponse): AccountingProductResult {
    return {
      externalId: String(product.id),
      rawResponse: {
        id: product.id,
        label: product.label,
        reference: product.reference,
        vatRate: product.vat_rate,
        priceBeforeTax: product.price_before_tax,
      },
    };
  }
}
