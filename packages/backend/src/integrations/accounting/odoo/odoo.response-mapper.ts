import {
  AccountingContactResult,
  AccountingInvoiceResult,
  AccountingPaymentResult,
  AccountingProductResult,
} from '../core/AccountingTypes';
import { OdooMove, OdooPartner, OdooPayment, OdooProduct } from './odoo.types';
import { OdooStatusMapper } from './odoo.status-mapper';

export class OdooResponseMapper {
  static toInvoiceResult(
    move: OdooMove,
    extraMeta?: Record<string, any>,
  ): AccountingInvoiceResult {
    const status = OdooStatusMapper.toKroptosStatus(move.state);

    return {
      externalId: String(move.id),
      externalNumber: move.name && move.name !== '/' ? move.name : undefined,
      rawResponse: {
        ...move,
        status,
        ...extraMeta,
      },
    };
  }

  static toContactResult(partner: OdooPartner): AccountingContactResult {
    return {
      externalId: String(partner.id),
      rawResponse: partner,
    };
  }

  static toProductResult(product: OdooProduct): AccountingProductResult {
    return {
      externalId: String(product.id),
      code: product.default_code,
      rawResponse: product,
    };
  }

  static toPaymentResult(payment: OdooPayment): AccountingPaymentResult {
    return {
      externalId: String(payment.id),
      rawResponse: payment,
    };
  }
}
