import { BadRequestException } from '@nestjs/common';
import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import { assertTotalsMatch } from '../core/AccountingAmount.util';
import {
  KOLAYBI_VALID_VAT_RATES,
  KolaybiContactPayload,
  KolaybiInvoiceItemPayload,
  KolaybiInvoicePayload,
  KolaybiPaymentPayload,
  KolaybiProductPayload,
  KolaybiVatRate,
} from './kolaybi.types';

export class KolaybiRequestMapper {
  static validateVatRate(rate: number): KolaybiVatRate {
    const roundedRate = Math.round(rate);
    if (!KOLAYBI_VALID_VAT_RATES.includes(roundedRate)) {
      throw new BadRequestException(
        `Desteklenmeyen KDV oranı: %${rate}. KolayBi' yalnızca 0, 1, 8, 10, 18, 20 oranlarını kabul eder.`,
      );
    }
    return roundedRate as KolaybiVatRate;
  }

  static toInvoicePayload(
    request: AccountingInvoiceRequest,
    defaultRetailContactId?: string | null,
  ): KolaybiInvoicePayload {
    // 1. Math verification
    assertTotalsMatch(request);

    // 2. Resolve contact_id
    let contactId = request.contact?.id;
    if (!contactId) {
      const taxNumber = request.contact?.taxNumber?.trim();
      const isValidTaxNumber = taxNumber && (taxNumber.length === 10 || taxNumber.length === 11);
      if (!isValidTaxNumber) {
        if (defaultRetailContactId) {
          contactId = defaultRetailContactId;
        } else {
          throw new BadRequestException(
            "KolayBi' için TCKN/VKN veya varsayılan perakende cari (defaultRetailContactId) zorunludur. Sahte TCKN üretilemez.",
          );
        }
      }
    }

    // 3. Map items & validate VAT rates
    const items: KolaybiInvoiceItemPayload[] = request.items.map((item) => {
      const vatRate = this.validateVatRate(item.vatRate);
      const grossTotal = Number((item.unitPrice * item.quantity).toFixed(2));
      const vatAmount = item.vatAmount ?? Number(((grossTotal * vatRate) / 100).toFixed(2));
      const totalAmount = item.totalAmount ?? Number((grossTotal + vatAmount).toFixed(2));

      return {
        product_id: item.sku,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        vat_rate: vatRate,
        discount_rate: 0,
        discount_amount: item.discountAmount ?? 0,
        gross_total: grossTotal,
        tax_total: vatAmount,
        net_total: totalAmount,
      };
    });

    return {
      contact_id: contactId || 'RETAIL_FALLBACK',
      order_date: request.issueDate,
      currency: (request.currency || 'TRY').toLowerCase(),
      invoice_no: request.referenceCode,
      description: request.notes || `KroptOS Sipariş #${request.referenceCode}`,
      notes: request.notes,
      items,
    };
  }

  static toContactPayload(request: AccountingContactRequest): KolaybiContactPayload {
    const taxNumber = (request.taxNumber || '').trim();
    if (!taxNumber) {
      throw new BadRequestException(
        "KolayBi' cari senkronizasyonu için TCKN veya VKN zorunludur.",
      );
    }

    const isCompany = request.isCompany ?? taxNumber.length === 10;
    return {
      name: request.name,
      identity_no: taxNumber,
      tax_office: request.taxOffice,
      type: isCompany ? 'company' : 'person',
      email: request.email,
      phone: request.phone,
      city: request.city,
      district: request.district,
      address: request.address,
    };
  }

  static toPaymentPayload(request: AccountingPaymentRequest): KolaybiPaymentPayload {
    let paymentType: 'cash' | 'credit_card' | 'bank_transfer' = 'credit_card';
    const method = (request.paymentMethod || '').toLowerCase();
    if (method.includes('cash') || method.includes('nakit')) {
      paymentType = 'cash';
    } else if (method.includes('bank') || method.includes('havale') || method.includes('eft')) {
      paymentType = 'bank_transfer';
    }

    return {
      invoice_id: request.invoiceExternalId,
      amount: request.amount,
      payment_date: request.paymentDate,
      payment_type: paymentType,
      account_id: request.accountId,
      description: request.notes || `Tahsilat ref: ${request.referenceCode}`,
    };
  }

  static toProductPayload(request: AccountingProductRequest): KolaybiProductPayload {
    const vatRate = this.validateVatRate(request.vatRate ?? 20);
    return {
      name: request.name,
      code: request.code || request.sku,
      tax_rate: vatRate,
      selling_price: request.unitPrice ?? 0,
      currency: (request.currency || 'TRY').toLowerCase(),
    };
  }
}
