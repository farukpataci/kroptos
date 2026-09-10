import { BadRequestException } from '@nestjs/common';
import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
} from '../core/AccountingTypes';
import {
  SageContactCreatePayload,
  SageSalesInvoiceCreatePayload,
} from './sage.types';

export interface SageMappingContext {
  defaultLedgerAccountId?: string;
  defaultTaxRateId?: string;
}

export class SageRequestMapper {
  /**
   * §4.5 & §6 Maps KroptOS invoice to Sage Sales Invoice payload.
   * Enforces non-empty reference (§4.5) and presence of ledger_account_id & tax_rate_id (§6).
   */
  static toSalesInvoiceCreatePayload(
    request: AccountingInvoiceRequest,
    contactExternalId: string,
    context: SageMappingContext,
  ): SageSalesInvoiceCreatePayload {
    const reference = request.referenceCode?.trim();
    if (!reference) {
      throw new BadRequestException(
        'Fatura referans kodu (referenceCode) boş bırakılamaz.',
      );
    }

    if (!context.defaultLedgerAccountId?.trim()) {
      throw new BadRequestException(
        'Sage entegrasyonunda varsayılan gelir hesabı (defaultLedgerAccountId) seçilmemiş. Fatura gönderilemez.',
      );
    }

    if (!context.defaultTaxRateId?.trim()) {
      throw new BadRequestException(
        'Sage entegrasyonunda varsayılan vergi oranı (defaultTaxRateId) seçilmemiş. Fatura gönderilemez.',
      );
    }

    const lines = request.items.map((item) => {
      const quantity = item.quantity > 0 ? item.quantity : 1;
      const unitPrice = item.unitPrice >= 0 ? item.unitPrice : 0;

      return {
        description: item.name || item.sku || 'Product Item',
        ledger_account_id: context.defaultLedgerAccountId!.trim(),
        tax_rate_id: context.defaultTaxRateId!.trim(),
        quantity,
        unit_price: unitPrice,
        discount_amount: item.discountAmount && item.discountAmount > 0 ? item.discountAmount : undefined,
      };
    });

    return {
      sales_invoice: {
        contact_id: contactExternalId,
        date: request.issueDate,
        due_date: request.dueDate || request.issueDate,
        reference,
        invoice_lines: lines,
      },
    };
  }

  /**
   * Maps KroptOS contact request to Sage Contact payload.
   */
  static toContactCreatePayload(
    request: AccountingContactRequest,
  ): SageContactCreatePayload {
    const name = request.name?.trim() || request.kroptosKey;

    return {
      contact: {
        name,
        contact_type_ids: ['CUSTOMER'],
        reference: request.kroptosKey,
        email: request.email?.trim() || undefined,
        tax_number: request.taxNumber?.trim() || undefined,
        main_address: request.address
          ? {
              address_line_1: request.address,
              city: request.city || undefined,
              country_id: undefined, // Sage uses ISO country ref
            }
          : undefined,
      },
    };
  }
}
