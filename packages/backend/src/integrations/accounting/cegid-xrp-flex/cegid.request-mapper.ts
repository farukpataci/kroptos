import { BadRequestException } from '@nestjs/common';
import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
} from '../core/AccountingTypes';
import {
  CegidCustomer,
  CegidPayment,
  CegidSalesInvoice,
  CegidSalesInvoiceDetail,
} from './cegid.types';

export interface CegidMappingContext {
  branchId?: string;
  defaultIncomeAccount?: string;
  defaultVatCode?: string;
  defaultAccountCodes?: Record<string, string>;
}

export class CegidRequestMapper {
  /**
   * Cari / Müşteri dönüştürücü (§2.c, Program.cs kalıbı)
   */
  static toCegidCustomer(
    req: AccountingContactRequest | any,
    context?: CegidMappingContext,
  ): CegidCustomer {
    if (!req.name || !req.name.trim()) {
      throw new BadRequestException(
        '[Cegid] Müşteri adı (name) zorunludur ve boş olamaz.',
      );
    }

    const customerId = (
      req.taxNumber ||
      req.kroptosKey ||
      req.name
    )
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 30);

    return {
      CustomerID: { value: customerId },
      CustomerName: { value: req.name.trim() },
      CustomerClass: { value: 'DEFAULT' },
      Status: { value: 'Active' },
      TaxRegistrationID: req.taxNumber ? { value: req.taxNumber.trim() } : undefined,
      MainContact: {
        DisplayName: { value: req.name.trim() },
        Email: req.email ? { value: req.email.trim() } : undefined,
        Phone1: req.phone ? { value: req.phone.trim() } : undefined,
        Address: {
          AddressLine1: req.address ? { value: req.address.trim() } : undefined,
          City: req.city ? { value: req.city.trim() } : undefined,
          PostalCode: (req as any).postalCode ? { value: String((req as any).postalCode).trim() } : undefined,
          Country: { value: (req as any).country || 'FR' },
        },
      },
    };
  }

  /**
   * Satış Faturası dönüştürücü (§2.e, §4.1, §6.4)
   * Taslak olarak (Hold: true) oluşturulur.
   */
  static toCegidSalesInvoice(
    req: AccountingInvoiceRequest | any,
    context?: CegidMappingContext,
  ): CegidSalesInvoice {
    const rawItems = req.items || req.lines || [];
    if (!rawItems || rawItems.length === 0) {
      throw new BadRequestException(
        '[Cegid] Faturada en az bir satır (item/line) bulunmalıdır.',
      );
    }

    // Hesap Planı ve KDV Kodu Kontrolü (§4.1)
    const incomeAccount =
      context?.defaultAccountCodes?.['salesAccount'] ||
      context?.defaultIncomeAccount;

    if (!incomeAccount) {
      throw new BadRequestException(
        '[Cegid] Fatura oluşturulamadı: Varsayılan gelir hesabı kodu (salesAccount) seçilmemiş. Lütfen bu bilgileri mali müşavirinizden alarak şirket ayarlarından yapılandırınız.',
      );
    }

    const vatCode =
      context?.defaultAccountCodes?.['vatCode'] || context?.defaultVatCode;

    const contact = req.contact || req.customer || {};
    const customerId = (
      contact.taxNumber ||
      contact.name ||
      req.customerId ||
      'CUST_GENERIC'
    )
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 30);

    const details: CegidSalesInvoiceDetail[] = rawItems.map((item: any, idx: number) => {
      const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
      const qty = typeof item.quantity === 'number' ? item.quantity : 1;

      return {
        rowNumber: idx + 1,
        Branch: context?.branchId ? { value: context.branchId } : undefined,
        InventoryID: {
          value: (item.sku || item.productCode || item.name || `ITEM_${idx + 1}`)
            .trim()
            .substring(0, 30),
        },
        TransactionDescription: { value: String(item.name || '').trim() },
        Qty: { value: qty },
        UnitPrice: { value: unitPrice },
        Amount: { value: Number((qty * unitPrice).toFixed(2)) },
        Account: { value: incomeAccount },
        TaxCategory: vatCode ? { value: vatCode } : undefined,
      };
    });

    const invoiceDate = req.issueDate
      ? new Date(req.issueDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const dueDate = req.dueDate
      ? new Date(req.dueDate).toISOString().split('T')[0]
      : invoiceDate;

    const orderRef = req.referenceCode || req.invoiceNumber;

    return {
      Type: { value: 'Invoice' },
      CustomerID: { value: customerId },
      CustomerOrder: orderRef ? { value: String(orderRef).trim() } : undefined,
      Date: { value: invoiceDate },
      DueDate: { value: dueDate },
      Description: {
        value: req.notes ? String(req.notes).trim() : 'KroptOS Satış Faturası',
      },
      Hold: { value: true }, // Taslak olarak oluşturulur (§6.4)
      Branch: context?.branchId ? { value: context.branchId } : undefined,
      Details: details,
    };
  }

  /**
   * Tahsilat / Ödeme dönüştürücü
   */
  static toCegidPayment(
    req: AccountingPaymentRequest | any,
    context?: CegidMappingContext,
  ): CegidPayment {
    if (!req.amount || req.amount <= 0) {
      throw new BadRequestException(
        '[Cegid] Ödeme tutarı sıfırdan büyük olmalıdır.',
      );
    }

    const customerId = (
      req.invoiceExternalId ||
      req.customerId ||
      'CUST_GENERIC'
    )
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 30);

    const paymentDate = req.paymentDate
      ? new Date(req.paymentDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    return {
      Type: { value: 'Payment' },
      CustomerID: { value: customerId },
      PaymentAmount: { value: req.amount },
      ApplicationDate: { value: paymentDate },
      Description: {
        value: req.referenceCode || req.reference || 'KroptOS Tahsilat',
      },
      Branch: context?.branchId ? { value: context.branchId } : undefined,
      Hold: { value: false },
    };
  }
}
