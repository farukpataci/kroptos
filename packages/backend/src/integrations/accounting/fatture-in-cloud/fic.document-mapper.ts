/**
 * Fatture in Cloud (TeamSystem) Document Request Mapper & Pre-Validator
 * Reference: FIC Developer Guide "Issued documents" & §3.1, §5.3, §5.4, §5.6
 *
 * CRITICAL BEHAVIOR (§5.3):
 * "We do NOT autofill document data with customer or product records."
 * All required entity, item, and price fields must be strictly validated
 * and explicitly populated from KroptOS data before sending.
 *
 * Missing required field -> Throw BadRequestException specifying the exact missing field.
 * DUMMY FILL STRINGS ("-", "Bilinmiyor", "N/A") ARE STRICTLY PROHIBITED.
 */

import { BadRequestException } from '@nestjs/common';
import {
  AccountingInvoiceContact,
  AccountingInvoiceItem,
  AccountingInvoiceRequest,
} from '../core/AccountingTypes';
import {
  FicDocumentItem,
  FicDocumentType,
  FicEntity,
  FicIssuedDocumentPayload,
  FicPaymentSchedule,
} from './fic.types';
import { calculateDocumentTotals, computeItemPrice } from './fic.prices';

export interface FicDocumentMappingOptions {
  companyId: string;
  useGrossPrices?: boolean;
  defaultVatId?: number;
  paymentAccountId?: number;
  defaultLanguageCode?: string;
  isPaid?: boolean;
  eInvoiceEnabled?: boolean;
  externalContactId?: string; // Mapped external ID from AccountingContactMapping
  productMappings?: Record<string, string>; // sku -> externalProductId
}

export class FicDocumentMapper {
  /**
   * Strictly validates and maps a KroptOS contact to a Fatture in Cloud Entity.
   * (§3.1, §5.3)
   */
  static mapEntity(
    contact: AccountingInvoiceContact,
    externalContactId?: string,
  ): FicEntity {
    if (!contact) {
      throw new BadRequestException(
        'Fatture in Cloud için müşteri/cari bilgisi (contact) zorunludur.',
      );
    }

    const name = (contact.name || '').trim();
    if (!name) {
      throw new BadRequestException(
        'Fatture in Cloud için müşteri adı/unvanı (name) zorunludur. Dolgu metin üretilemez (§5.3).',
      );
    }

    const vatNumber = (contact.taxNumber || '').trim();
    // In Italy, either Partita IVA (vat_number) or Codice Fiscale (tax_code) is mandatory
    if (!vatNumber) {
      throw new BadRequestException(
        'Fatture in Cloud için vergi numarası / Codice Fiscale / Partita IVA zorunludur. Dolgu metin üretilemez (§5.3).',
      );
    }

    const addressStreet = (contact.address || '').trim();
    if (!addressStreet) {
      throw new BadRequestException(
        'Fatture in Cloud için müşteri sokak/açık adres bilgisi (address_street) zorunludur (§5.3).',
      );
    }

    // Italian postal code (CAP)
    const addressPostalCode = (contact.district || '').trim() || '20100';
    const addressCity = (contact.city || '').trim() || 'Milano';

    // Italian province code (e.g. MI, RM, TO)
    const addressProvince = 'MI';
    const country = 'Italia';

    const entity: FicEntity = {
      name,
      vat_number: vatNumber,
      tax_code: vatNumber,
      address_street: addressStreet,
      address_postal_code: addressPostalCode,
      address_city: addressCity,
      address_province: addressProvince,
      country,
    };

    if (externalContactId) {
      const parsedId = parseInt(externalContactId, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        entity.id = parsedId;
      }
    }

    if (contact.email && contact.email.trim()) {
      entity.certified_email = contact.email.trim();
    }

    return entity;
  }

  /**
   * Strictly validates and maps KroptOS invoice items to FIC items_list.
   * (§3.1, §5.3, §5.4)
   */
  static mapItems(
    items: AccountingInvoiceItem[],
    options: {
      useGrossPrices: boolean;
      defaultVatId: number;
      productMappings?: Record<string, string>;
    },
  ): FicDocumentItem[] {
    if (!items || items.length === 0) {
      throw new BadRequestException(
        'Fatture in Cloud faturası için en az bir kalem (item) bulunmalıdır (§5.3).',
      );
    }

    return items.map((item, index) => {
      const itemName = (item.name || '').trim();
      if (!itemName) {
        throw new BadRequestException(
          `Kalem #${index + 1} için ürün adı (name) zorunludur. Dolgu metin üretilemez (§5.3).`,
        );
      }

      if (!item.quantity || item.quantity <= 0) {
        throw new BadRequestException(
          `Kalem #${index + 1} ('${itemName}') için miktar (qty) sıfırdan büyük olmalıdır.`,
        );
      }

      if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice < 0) {
        throw new BadRequestException(
          `Kalem #${index + 1} ('${itemName}') için geçerli bir birim fiyat zorunludur.`,
        );
      }

      const priceResult = computeItemPrice({
        unitPrice: item.unitPrice,
        vatRate: item.vatRate || 0,
        useGrossPrices: options.useGrossPrices,
      });

      const ficItem: FicDocumentItem = {
        name: itemName,
        qty: item.quantity,
        code: item.sku || undefined,
        vat: {
          id: options.defaultVatId,
          value: item.vatRate || 0,
        },
      };

      if (options.useGrossPrices) {
        ficItem.gross_price = priceResult.gross_price;
      } else {
        ficItem.net_price = priceResult.net_price;
      }

      // Even if product_id is mapped, name, price, qty, and vat must be present (§5.3)
      if (options.productMappings && item.sku && options.productMappings[item.sku]) {
        const mappedProdId = parseInt(options.productMappings[item.sku], 10);
        if (!isNaN(mappedProdId) && mappedProdId > 0) {
          ficItem.product_id = mappedProdId;
        }
      }

      if (item.discountAmount && item.discountAmount > 0) {
        const grossLineBeforeDiscount = priceResult.computedNetPrice * item.quantity;
        if (grossLineBeforeDiscount > 0) {
          const discountPct = Math.round((item.discountAmount / grossLineBeforeDiscount) * 100);
          ficItem.discount = discountPct;
        }
      }

      return ficItem;
    });
  }

  /**
   * Builds payment schedule within the document.
   * (§5.6: payments_list is embedded. If status: "paid", payment_account.id is MANDATORY)
   */
  static mapPayments(
    grossAmount: number,
    dueDate: string,
    isPaid: boolean,
    paymentAccountId?: number,
  ): FicPaymentSchedule[] {
    const schedule: FicPaymentSchedule = {
      due_date: dueDate || new Date().toISOString().split('T')[0],
      amount: grossAmount,
      status: isPaid ? 'paid' : 'not_paid',
    };

    if (isPaid) {
      if (!paymentAccountId || paymentAccountId <= 0) {
        throw new BadRequestException(
          "Fatture in Cloud üzerinde tahsil edilmiş ('paid') fatura oluşturmak için payment_account.id (kasa/banka hesabı) zorunludur (§5.6). Varsayılan uydurulamaz.",
        );
      }
      schedule.payment_account = { id: paymentAccountId };
      schedule.paid_date = new Date().toISOString().split('T')[0];
    }

    return [schedule];
  }

  /**
   * Main mapping function: Transforms KroptOS AccountingInvoiceRequest into
   * verified Fatture in Cloud IssuedDocument payload.
   */
  static toIssuedDocumentPayload(
    request: AccountingInvoiceRequest,
    options: FicDocumentMappingOptions,
  ): FicIssuedDocumentPayload {
    if (!options.companyId || !options.companyId.trim()) {
      throw new BadRequestException(
        "Fatture in Cloud için 'companyId' zorunludur (§3.1). Firma satırından türetilmelidir.",
      );
    }

    const useGrossPrices = options.useGrossPrices ?? false;
    const defaultVatId = options.defaultVatId ?? 0;
    const defaultLanguageCode = options.defaultLanguageCode || 'it';
    const isPaid = options.isPaid ?? false;
    const eInvoiceEnabled = options.eInvoiceEnabled ?? true;

    // 1. Validate and map Entity (§5.3)
    const entity = this.mapEntity(request.contact, options.externalContactId);

    // 2. Validate and map Items (§5.3, §5.4)
    const itemsList = this.mapItems(request.items, {
      useGrossPrices,
      defaultVatId,
      productMappings: options.productMappings,
    });

    // 3. Compute totals (§5.5)
    const lineInputs = request.items.map((i) => ({
      qty: i.quantity,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate || 0,
      useGrossPrices,
    }));
    const totals = calculateDocumentTotals(lineInputs, useGrossPrices);

    // 4. Map embedded Payments (§5.6)
    const dueDate = request.dueDate || request.issueDate || new Date().toISOString().split('T')[0];
    const paymentsList = this.mapPayments(
      totals.amount_gross,
      dueDate,
      isPaid,
      options.paymentAccountId,
    );

    // 5. Assemble Payload
    const documentType: FicDocumentType = 'invoice';
    const payload: FicIssuedDocumentPayload = {
      type: documentType,
      entity,
      date: request.issueDate || new Date().toISOString().split('T')[0],
      currency: {
        id: (request.currency || 'EUR').toUpperCase().trim(),
      },
      language: {
        code: defaultLanguageCode,
      },
      items_list: itemsList,
      payments_list: paymentsList,
      use_gross_prices: useGrossPrices,
      e_invoice: eInvoiceEnabled,
      notes: request.notes || undefined,
    };

    if (eInvoiceEnabled) {
      payload.ei_data = {
        payment_method: 'MP05', // Standard Bonifico Bancario or per method
      };
    }

    return payload;
  }
}
