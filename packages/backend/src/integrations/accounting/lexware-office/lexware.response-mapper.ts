import {
  AccountingContactResult,
  AccountingInvoiceResult,
  AccountingProductResult,
} from '../core/AccountingTypes';
import { LexwareArticle, LexwareContact, LexwareInvoice } from './lexware.types';

export class LexwareResponseMapper {
  static toInvoiceResult(
    invoice: LexwareInvoice,
    options?: {
      reconciled?: boolean;
      finalized?: boolean;
      idempotentReplay?: boolean;
      mismatchWarning?: string;
    },
  ): AccountingInvoiceResult {
    return {
      externalId: invoice.id,
      externalNumber: invoice.voucherNumber || `DRAFT-${invoice.id.slice(0, 8)}`,
      rawResponse: {
        id: invoice.id,
        voucherNumber: invoice.voucherNumber,
        voucherStatus: invoice.voucherStatus,
        version: invoice.version,
        totalPrice: invoice.totalPrice,
        reconciled: options?.reconciled ?? true,
        finalized: options?.finalized ?? (invoice.voucherStatus === 'open' || invoice.voucherStatus === 'paid'),
        idempotentReplay: options?.idempotentReplay ?? false,
        mismatchWarning: options?.mismatchWarning,
      },
    };
  }

  static toContactResult(contact: LexwareContact): AccountingContactResult {
    return {
      externalId: contact.id,
      rawResponse: {
        id: contact.id,
        version: contact.version,
        roles: contact.roles,
        company: contact.company,
        person: contact.person,
      },
    };
  }

  static toProductResult(article: LexwareArticle): AccountingProductResult {
    return {
      externalId: article.id,
      rawResponse: {
        id: article.id,
        version: article.version,
        title: article.title,
        price: article.price,
      },
    };
  }
}
