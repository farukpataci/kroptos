import { BadRequestException } from '@nestjs/common';
import {
  AccountingInvoiceRequest,
  AccountingInvoiceContact,
  AccountingPaymentRequest,
} from '../core/AccountingTypes';
import {
  NetSuiteCustomerPayload,
  NetSuiteInvoicePayload,
  NetSuitePaymentPayload,
  NetSuiteItemPayload,
  NetSuiteCredentials,
} from './netsuite.types';

/**
 * NetSuite İstek Eşleyicisi (§5.7, §5.8, §5.9)
 *
 * KRİTİK İLKELER:
 * 1. Subsidiary (§5.9): OneWorld hesaplarında subsidiary seçimi yapılandırmadan (credentials.subsidiaryId) gelir.
 *    KESİNLİKLE istekten okunmaz veya koda sabitlenmez.
 * 2. externalId (§5.7): KroptOS referansı externalId alanına yazılır (eid: ile upsert ve idempotency desteği).
 * 3. Pre-validation (§5.6, §5.8): Zorunlu alanlar, tutarlar ve satırlar göndermeden önce katı şekilde kontrol edilir.
 */
export class NetSuiteRequestMapper {
  /**
   * KroptOS Fatura İsteğini NetSuite REST Fatura Yüküne dönüştürür.
   */
  static toNetSuiteInvoice(
    request: AccountingInvoiceRequest,
    customerId: string | number,
    credentials: NetSuiteCredentials,
  ): NetSuiteInvoicePayload {
    if (!request) {
      throw new BadRequestException('[NetSuite Mapper] Fatura istek verisi eksik.');
    }
    if (!customerId) {
      throw new BadRequestException('[NetSuite Mapper] Müşteri (entity/customer) kimliği zorunludur.');
    }
    if (!request.items || request.items.length === 0) {
      throw new BadRequestException('[NetSuite Mapper] Faturada en az bir satır bulunmalıdır.');
    }

    // Satır tutarlarını ve miktar doğrulaması (§5.8)
    for (const item of request.items) {
      if (!item.quantity || item.quantity <= 0) {
        throw new BadRequestException(
          `[NetSuite Mapper] Geçersiz ürün miktarı: ${item.sku || item.name} (miktar > 0 olmalı).`,
        );
      }
    }

    const payload: NetSuiteInvoicePayload = {
      entity: { id: String(customerId) },
      tranDate: request.issueDate,
      dueDate: request.dueDate,
      otherRefNum: request.referenceCode,
      memo: request.notes,
      externalId: request.referenceCode, // §5.7 Idempotency ve eid: upsert
      currency: request.currency ? { refName: request.currency } : undefined,
      item: {
        items: request.items.map((it) => ({
          item: { id: it.sku || it.name },
          quantity: it.quantity,
          rate: it.unitPrice,
          amount: it.totalAmount,
          description: it.name,
        })),
      },
    };

    // Subsidiary ekleme (OneWorld - §5.9)
    if (credentials.subsidiaryId) {
      payload.subsidiary = { id: String(credentials.subsidiaryId) };
    }

    return payload;
  }

  /**
   * KroptOS Cari Bilgisini NetSuite Customer Yüküne dönüştürür.
   */
  static toNetSuiteCustomer(
    contact: AccountingInvoiceContact | any,
    credentials: NetSuiteCredentials,
  ): NetSuiteCustomerPayload {
    if (!contact || !contact.name?.trim()) {
      throw new BadRequestException('[NetSuite Mapper] Cari adı (contact name) zorunludur.');
    }

    const payload: NetSuiteCustomerPayload = {
      companyName: contact.name.trim(),
      isPerson: !contact.isCompany,
      email: contact.email?.trim(),
      phone: contact.phone?.trim(),
      externalId: contact.taxNumber || contact.id || contact.name.trim(),
    };

    if (credentials.subsidiaryId) {
      payload.subsidiary = { id: String(credentials.subsidiaryId) };
    }

    return payload;
  }

  /**
   * KroptOS Tahsilat İsteğini NetSuite CustomerPayment Yüküne dönüştürür.
   */
  static toNetSuitePayment(
    request: AccountingPaymentRequest,
    customerId: string | number,
    credentials: NetSuiteCredentials,
  ): NetSuitePaymentPayload {
    if (!request) {
      throw new BadRequestException('[NetSuite Mapper] Ödeme istek verisi eksik.');
    }
    if (!customerId) {
      throw new BadRequestException('[NetSuite Mapper] Ödeme için müşteri (customer) kimliği zorunludur.');
    }
    if (!request.amount || request.amount <= 0) {
      throw new BadRequestException('[NetSuite Mapper] Ödeme tutarı sıfırdan büyük olmalıdır.');
    }

    const payload: NetSuitePaymentPayload = {
      customer: { id: String(customerId) },
      payment: request.amount,
      tranDate: request.paymentDate,
      memo: request.referenceCode,
      externalId: request.referenceCode,
    };

    if (credentials.subsidiaryId) {
      payload.subsidiary = { id: String(credentials.subsidiaryId) };
    }

    return payload;
  }
}
