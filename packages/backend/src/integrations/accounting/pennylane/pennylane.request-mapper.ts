import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import {
  PennylaneCreateInvoiceRequest,
  PennylaneCustomerRequest,
  PennylaneProductRequest,
} from './pennylane.types';
import { PennylaneSerializer } from './pennylane.serialize';
import { PennylaneVatMapper } from './pennylane.vat';

export interface PennylaneInvoiceMappingContext {
  customerId: number;
  externalReference?: string;
  defaultVatRate?: string | number;
}

/**
 * Pennylane İstek Eşleyicisi (§5, §9)
 */
export class PennylaneRequestMapper {
  static toCreateInvoice(
    request: AccountingInvoiceRequest,
    context: PennylaneInvoiceMappingContext,
  ): PennylaneCreateInvoiceRequest {
    const issueDate = request.issueDate || new Date().toISOString().slice(0, 10);
    const deadline = request.dueDate || issueDate;
    const externalRef = context.externalReference || request.referenceCode;

    const lines = (request.items || []).map((item) => {
      const unitPriceStr = PennylaneSerializer.formatMonetary(item.unitPrice);
      const vatCode = PennylaneVatMapper.mapRateToCode(
        item.vatRate !== undefined ? item.vatRate : context.defaultVatRate,
      );

      const line = {
        label: item.name || 'Genel Kalem',
        quantity: PennylaneSerializer.formatQuantity(item.quantity ?? 1),
        unit: 'piece',
        raw_currency_unit_price: unitPriceStr,
        vat_rate: vatCode,
      };

      // String tipi doğrulaması (§9.3)
      PennylaneSerializer.assertLinePriceIsString(line);

      return line;
    });

    if (lines.length === 0) {
      const defaultPrice = PennylaneSerializer.formatMonetary(request.grandTotal || 0);
      const defaultVat = PennylaneVatMapper.mapRateToCode(context.defaultVatRate || 20);
      lines.push({
        label: 'Genel Satış Hizmeti',
        quantity: PennylaneSerializer.formatQuantity(1),
        unit: 'piece',
        raw_currency_unit_price: defaultPrice,
        vat_rate: defaultVat,
      });
    }

    return {
      customer_id: context.customerId,
      date: issueDate,
      deadline,
      draft: true, // §5.1: ZORUNLU!
      currency: request.currency || 'EUR',
      external_reference: externalRef, // §5.5, §9.10
      invoice_lines: lines,
    };
  }

  static toCustomerRequest(contact: AccountingContactRequest): PennylaneCustomerRequest {
    const name = contact.name || 'İsimsiz Müşteri';
    const emails = contact.email ? [contact.email] : [];
    const taxNumber = contact.taxNumber?.trim();

    return {
      name,
      reg_no: taxNumber && (taxNumber.length === 9 || taxNumber.length === 14) ? taxNumber : undefined,
      vat_number: taxNumber && taxNumber.startsWith('FR') ? taxNumber : undefined,
      emails: emails.length > 0 ? emails : undefined,
      phone: contact.phone,
      address: {
        address: contact.address,
        city: contact.city,
        country_alpha2: 'FR',
      },
      external_reference: contact.kroptosKey || contact.taxNumber,
    };
  }

  static toProductRequest(product: AccountingProductRequest): PennylaneProductRequest {
    return {
      label: product.name,
      reference: product.sku,
      unit: 'piece',
      vat_rate: PennylaneVatMapper.mapRateToCode(product.vatRate),
      price_before_tax: PennylaneSerializer.formatMonetary(product.unitPrice),
    };
  }
}
