import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import {
  FortnoxArticle,
  FortnoxConfig,
  FortnoxCustomer,
  FortnoxInvoice,
  FortnoxInvoiceRow,
  FortnoxPayment,
} from './fortnox.types';

export class FortnoxRequestMapper {
  /**
   * Map KroptOS AccountingInvoiceRequest to FortnoxInvoice (§5.7, §5.9)
   */
  static toFortnoxInvoice(
    request: AccountingInvoiceRequest,
    config?: Partial<FortnoxConfig>,
  ): FortnoxInvoice {
    const defaultAccount = config?.defaultSalesAccount ?? 3001; // Swedish BAS plan: 3001 (Sales 25% VAT)
    const currency = request.currency ? request.currency.toUpperCase() : 'SEK';

    const invoiceRows: FortnoxInvoiceRow[] = (request.items || []).map((item) => ({
      ArticleNumber: item.sku,
      Description: item.name,
      DeliveredQuantity: item.quantity,
      Price: item.unitPrice,
      VAT: item.vatRate ?? config?.defaultVATRate ?? 25,
      AccountNumber: defaultAccount,
      Discount: item.discountAmount,
      DiscountType: item.discountAmount ? 'AMOUNT' : undefined,
    }));

    return {
      CustomerNumber: request.contact.id || request.contact.taxNumber || '1',
      CustomerName: request.contact.name,
      InvoiceDate: request.issueDate.slice(0, 10),
      DueDate: request.dueDate ? request.dueDate.slice(0, 10) : undefined,
      Currency: currency,
      YourOrderNumber: request.referenceCode, // External reference filterable in Fortnox (§5.7)
      Comments: request.notes ? `${request.referenceCode} - ${request.notes}` : request.referenceCode,
      InvoiceRows: invoiceRows,
    };
  }

  /**
   * Map KroptOS AccountingContactRequest to FortnoxCustomer
   */
  static toFortnoxCustomer(request: AccountingContactRequest): FortnoxCustomer {
    return {
      CustomerNumber: request.kroptosKey || request.taxNumber || '1',
      Name: request.name,
      OrganisationNumber: request.taxNumber,
      Email: request.email,
      Phone1: request.phone,
      Address1: request.address,
      City: request.city,
    };
  }

  /**
   * Map KroptOS AccountingProductRequest to FortnoxArticle
   */
  static toFortnoxArticle(
    request: AccountingProductRequest,
    config?: Partial<FortnoxConfig>,
  ): FortnoxArticle {
    return {
      ArticleNumber: request.sku,
      Description: request.name,
      SalesPrice: request.unitPrice ?? 0,
      VAT: request.vatRate ?? config?.defaultVATRate ?? 25,
    };
  }

  /**
   * Map KroptOS AccountingPaymentRequest to FortnoxPayment
   */
  static toFortnoxPayment(request: AccountingPaymentRequest): FortnoxPayment {
    return {
      InvoiceNumber: request.invoiceExternalId,
      Amount: request.amount,
      PaymentDate: request.paymentDate.slice(0, 10),
    };
  }
}
