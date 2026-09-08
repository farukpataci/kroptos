/**
 * BizimHesap Request Mapper
 * Source: https://apidocs.bizimhesap.com (POST /api/b2b/addinvoice, 2026-09)
 */

import { BadRequestException } from '@nestjs/common';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';
import { generateContactKey } from '../../../modules/accounting/utils/contact-key.util';
import { calculateAndVerifyBizimhesapAmounts } from './bizimhesap.amounts';
import {
  BIZIMHESAP_SUPPORTED_CURRENCIES,
  BizimhesapCurrency,
  BizimhesapInvoicePayload,
} from './bizimhesap.types';

export class BizimhesapRequestMapper {
  /**
   * Maps KroptOS currency to BizimHesap currency code.
   * KroptOS uses ISO-4217 'TRY'; BizimHesap expects 'TL'.
   */
  static mapCurrency(currency: string): BizimhesapCurrency {
    const upper = (currency || 'TRY').toUpperCase().trim();
    let mapped: string;
    if (upper === 'TRY' || upper === 'TL') {
      mapped = 'TL';
    } else {
      mapped = upper;
    }

    if (!BIZIMHESAP_SUPPORTED_CURRENCIES.includes(mapped)) {
      throw new BadRequestException(
        `Desteklenmeyen para birimi: '${currency}'. BizimHesap yalnızca TL, USD, EUR, CHF, GBP destekler.`,
      );
    }

    return mapped as BizimhesapCurrency;
  }

  /**
   * Formats ISO 8601 date string for BizimHesap.
   */
  static formatDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString();
    if (dateStr.includes('T')) return dateStr;
    return `${dateStr}T00:00:00Z`;
  }

  /**
   * Transforms AccountingInvoiceRequest to verified BizimHesap B2B AddInvoice payload.
   * firmId is strictly derived from authorized company credentials and never from request body.
   */
  static toInvoicePayload(
    request: AccountingInvoiceRequest,
    firmId: string,
  ): BizimhesapInvoicePayload {
    if (!firmId || !firmId.trim()) {
      throw new BadRequestException(
        "BizimHesap için zorunlu 'firmId' bulunamadı. Şube veya entegrasyon ayarlarını kontrol ediniz.",
      );
    }

    // 1. Customer title and address are strictly required (§4.2)
    const customerTitle = (request.contact?.name || '').trim();
    if (!customerTitle) {
      throw new BadRequestException(
        "BizimHesap için müşteri adı/unvanı (customer.title) zorunludur. Dolgu metin üretilemez.",
      );
    }

    const customerAddress = (request.contact?.address || '').trim();
    if (!customerAddress) {
      throw new BadRequestException(
        "BizimHesap için müşteri fatura adresi (customer.address) zorunludur. Dolgu metin üretilemez.",
      );
    }

    // 2. Deterministic, stable customerId generation via contact-key.util (§4.2)
    const customerId = generateContactKey({
      taxNumber: request.contact?.taxNumber,
      email: request.contact?.email,
      phone: request.contact?.phone,
      name: customerTitle,
    });

    // 3. Currency mapping (§4.4)
    const currency = this.mapCurrency(request.currency);

    // 4. Decimal math and kuruş artığı validation (§4.4)
    const { amounts, details } = calculateAndVerifyBizimhesapAmounts(request, currency);

    // 5. Build payload (§3.3)
    return {
      firmId: firmId.trim(),
      invoiceNo: request.referenceCode, // Always KroptOS reference code (§4.6)
      invoiceType: 3, // 3 = Satış Faturası
      note: request.notes,
      dates: {
        invoiceDate: this.formatDate(request.issueDate),
        dueDate: this.formatDate(request.dueDate || request.issueDate),
      },
      customer: {
        customerId,
        title: customerTitle,
        address: customerAddress,
        taxOffice: request.contact?.taxOffice,
        taxNo: request.contact?.taxNumber,
        email: request.contact?.email,
        phone: request.contact?.phone,
      },
      amounts,
      details,
    };
  }
}
