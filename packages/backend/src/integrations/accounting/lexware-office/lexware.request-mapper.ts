import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import {
  LexwareAddress,
  LexwareArticle,
  LexwareContact,
  LexwareCreateInvoiceRequest,
  LexwareLineItem,
  LexwareTaxAmount,
} from './lexware.types';

export class LexwareRequestMapper {
  /**
   * Maps KroptOS invoice request to Lexware draft invoice payload (§5.2, §5.5, §5.6).
   * Notice: Strictly EUR currency and draft payload without any finalize query param.
   */
  static toCreateInvoice(request: AccountingInvoiceRequest): LexwareCreateInvoiceRequest {
    const address: LexwareAddress = {
      name: request.contact.name || 'Müşteri',
      street: request.contact.address || 'Bilinmeyen Adres',
      city: 'Berlin',
      zip: '10115',
      countryCode: 'DE',
    };

    const lineItems: LexwareLineItem[] = request.items.map((it) => {
      const quantity = it.quantity || 1;
      const netAmount = Number(it.unitPrice.toFixed(2));
      const vatRate = Number((it.vatRate || 0).toFixed(2));
      const grossAmount = Number(((netAmount * (100 + vatRate)) / 100).toFixed(2));

      return {
        type: 'custom',
        name: it.name || it.sku,
        description: it.sku ? `SKU: ${it.sku}` : undefined,
        quantity,
        unitName: 'Stück',
        unitPrice: {
          currency: 'EUR',
          netAmount,
          grossAmount,
          taxRatePercentage: vatRate,
        },
      };
    });

    // Aggregate tax amounts by tax rate
    const taxMap = new Map<number, { taxAmount: number; netAmount: number }>();
    for (const it of request.items) {
      const rate = it.vatRate || 0;
      const existing = taxMap.get(rate) || { taxAmount: 0, netAmount: 0 };
      existing.taxAmount += it.vatAmount || 0;
      existing.netAmount += it.totalAmount - (it.vatAmount || 0);
      taxMap.set(rate, existing);
    }

    const taxAmounts: LexwareTaxAmount[] = Array.from(taxMap.entries()).map(([rate, val]) => ({
      taxRatePercentage: rate,
      taxAmount: Number(val.taxAmount.toFixed(2)),
      netAmount: Number(val.netAmount.toFixed(2)),
    }));

    const totalNetAmount = Number((request.subtotal ?? (request.grandTotal - (request.vatTotal || 0))).toFixed(2));
    const totalTaxAmount = Number((request.vatTotal || 0).toFixed(2));
    const totalGrossAmount = Number(request.grandTotal.toFixed(2));

    return {
      voucherDate: request.issueDate || new Date().toISOString().slice(0, 10),
      address,
      lineItems,
      totalPrice: {
        currency: 'EUR',
        totalNetAmount,
        totalGrossAmount,
        totalTaxAmount,
      },
      taxAmounts,
      taxConditions: {
        taxType: 'net',
      },
      introduction: `Sipariş Referansı: ${request.referenceCode}`,
      remark: request.notes,
    };
  }

  static toContact(request: AccountingContactRequest): Partial<LexwareContact> {
    return {
      roles: {
        customer: {},
      },
      company: request.taxNumber
        ? {
            name: request.name,
            vatRegistrationNumber: request.taxNumber,
          }
        : undefined,
      person: !request.taxNumber
        ? {
            lastName: request.name,
          }
        : undefined,
      addresses: {
        billing: [
          {
            name: request.name,
            street: request.address || '',
            city: 'Berlin',
            zip: '10115',
            countryCode: 'DE',
          },
        ],
      },
      emailAddresses: request.email
        ? {
            business: [request.email],
          }
        : undefined,
    };
  }

  static toArticle(request: AccountingProductRequest): Partial<LexwareArticle> {
    const netPrice = Number((request.unitPrice || 0).toFixed(2));
    const taxRate = Number((request.vatRate || 19).toFixed(2));
    const grossPrice = Number(((netPrice * (100 + taxRate)) / 100).toFixed(2));

    return {
      title: request.name,
      description: `KroptOS Ürün: ${request.sku}`,
      articleNumber: request.sku,
      unitName: 'Stück',
      price: {
        leadingPrice: 'NET',
        netPrice,
        grossPrice,
        taxRatePercentage: taxRate,
      },
    };
  }
}
