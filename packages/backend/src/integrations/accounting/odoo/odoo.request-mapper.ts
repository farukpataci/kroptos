import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';

export class OdooRequestMapper {
  /**
   * Map KroptOS invoice request to Odoo account.move draft payload (§5.4)
   */
  static toOdooInvoice(
    req: AccountingInvoiceRequest,
    partnerId: number,
    options?: {
      journalId?: number;
      defaultTaxId?: number;
    },
  ): Record<string, any> {
    const lines = req.items.map((item) => {
      const taxIds = options?.defaultTaxId ? [[6, 0, [options.defaultTaxId]]] : [];
      return [
        0,
        0,
        {
          name: item.name || item.sku,
          quantity: item.quantity,
          price_unit: item.unitPrice,
          tax_ids: taxIds,
        },
      ];
    });

    const payload: Record<string, any> = {
      move_type: 'out_invoice',
      partner_id: partnerId,
      ref: req.referenceCode,
      invoice_date: req.issueDate,
      invoice_line_ids: lines,
    };

    if (options?.journalId) {
      payload.journal_id = options.journalId;
    }

    return payload;
  }

  /**
   * Map KroptOS contact request to Odoo res.partner payload
   */
  static toOdooPartner(req: AccountingContactRequest): Record<string, any> {
    const payload: Record<string, any> = {
      name: req.name,
    };

    if (req.email) payload.email = req.email;
    if (req.phone) payload.phone = req.phone;
    if (req.taxNumber) payload.vat = req.taxNumber;
    if (req.address) payload.street = req.address;
    if (req.city) payload.city = req.city;

    return payload;
  }

  /**
   * Map KroptOS product request to Odoo product.product payload
   */
  static toOdooProduct(req: AccountingProductRequest): Record<string, any> {
    const payload: Record<string, any> = {
      name: req.name,
      default_code: req.sku || req.code,
    };

    if (req.unitPrice !== undefined) {
      payload.list_price = req.unitPrice;
    }

    return payload;
  }

  /**
   * Map KroptOS payment request to Odoo account.payment payload
   */
  static toOdooPayment(
    req: AccountingPaymentRequest,
    partnerId: number,
    options?: {
      journalId?: number;
    },
  ): Record<string, any> {
    const payload: Record<string, any> = {
      payment_type: 'inbound',
      partner_type: 'customer',
      partner_id: partnerId,
      amount: req.amount,
      ref: req.referenceCode,
      date: req.paymentDate,
    };

    if (options?.journalId) {
      payload.journal_id = options.journalId;
    }

    return payload;
  }
}
