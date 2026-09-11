import {
  AccountingContactResult,
  AccountingInvoiceResult,
  AccountingPaymentResult,
  AccountingProductResult,
} from '../core/AccountingTypes';
import {
  FortnoxArticle,
  FortnoxCustomer,
  FortnoxInvoice,
  FortnoxPayment,
} from './fortnox.types';

export class FortnoxResponseMapper {
  static toInvoiceResult(invoice: FortnoxInvoice): AccountingInvoiceResult {
    const documentNumber = String(invoice.DocumentNumber || '');
    return {
      externalId: documentNumber,
      externalNumber: documentNumber,
      rawResponse: {
        DocumentNumber: invoice.DocumentNumber,
        CustomerNumber: invoice.CustomerNumber,
        CustomerName: invoice.CustomerName,
        InvoiceDate: invoice.InvoiceDate,
        Total: invoice.Total,
        TotalVAT: invoice.TotalVAT,
        Currency: invoice.Currency,
        Booked: invoice.Booked,
        Cancelled: invoice.Cancelled,
        YourOrderNumber: invoice.YourOrderNumber,
      },
    };
  }

  static toContactResult(customer: FortnoxCustomer): AccountingContactResult {
    return {
      externalId: customer.CustomerNumber,
      rawResponse: {
        CustomerNumber: customer.CustomerNumber,
        Name: customer.Name,
        OrganisationNumber: customer.OrganisationNumber,
      },
    };
  }

  static toProductResult(article: FortnoxArticle): AccountingProductResult {
    return {
      externalId: article.ArticleNumber,
      code: article.ArticleNumber,
      rawResponse: {
        ArticleNumber: article.ArticleNumber,
        Description: article.Description,
        SalesPrice: article.SalesPrice,
      },
    };
  }

  static toPaymentResult(payment: FortnoxPayment): AccountingPaymentResult {
    return {
      externalId: String(payment.Number || payment.InvoiceNumber || ''),
      rawResponse: {
        Number: payment.Number,
        InvoiceNumber: payment.InvoiceNumber,
        Amount: payment.Amount,
        PaymentDate: payment.PaymentDate,
        Booked: payment.Booked,
      },
    };
  }
}
