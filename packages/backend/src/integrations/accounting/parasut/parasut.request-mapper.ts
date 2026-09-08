import {
  AccountingAmountMismatchError,
} from '../core/AccountingErrors';
import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import {
  ParasutContactAttributes,
  ParasutInvoiceItemAttributes,
  ParasutJsonApiResource,
  ParasutPaymentAttributes,
  ParasutProductAttributes,
  ParasutSalesInvoiceAttributes,
} from './parasut.types';

export class ParasutRequestMapper {
  /**
   * Validates amount arithmetic and formats an invoice into Paraşüt JSON:API structure.
   */
  static toSalesInvoiceResource(
    request: AccountingInvoiceRequest,
    externalContactId?: string,
  ): ParasutJsonApiResource<ParasutSalesInvoiceAttributes> {
    const computedItemsTotal = request.items.reduce((sum, item) => sum + item.totalAmount, 0);
    const discount = request.discountTotal || 0;
    const computedGrandTotal = Number((computedItemsTotal - discount).toFixed(4));
    const declaredGrandTotal = Number(request.grandTotal.toFixed(4));

    // Tolerance 0.02 for rounding differences across multi-line tax calculations
    if (Math.abs(computedGrandTotal - declaredGrandTotal) > 0.02) {
      throw new AccountingAmountMismatchError(
        `Fatura tutar uyumsuzluğu: Kalemler toplamı (${computedGrandTotal}) ile genel toplam (${declaredGrandTotal}) eşleşmiyor.`,
      );
    }

    const details: ParasutJsonApiResource<ParasutInvoiceItemAttributes>[] = request.items.map(
      (item) => ({
        type: 'sales_invoice_details',
        attributes: {
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          vat_rate: item.vatRate,
          discount_value: item.discountAmount,
          discount_type: item.discountAmount ? 'amount' : undefined,
          description: `SKU: ${item.sku}`,
        },
      }),
    );

    const resource: ParasutJsonApiResource<ParasutSalesInvoiceAttributes> = {
      type: 'sales_invoices',
      attributes: {
        item_type: 'invoice',
        description: request.notes || `KroptOS Ref: ${request.referenceCode}`,
        issue_date: request.issueDate,
        due_date: request.dueDate || request.issueDate,
        currency: request.currency,
        net_total: request.subtotal,
      },
      relationships: {
        details: {
          data: details,
        },
        contact: externalContactId
          ? {
              data: {
                id: externalContactId,
                type: 'contacts',
              },
            }
          : undefined,
      },
    };

    return resource;
  }

  static toContactResource(
    request: AccountingContactRequest,
  ): ParasutJsonApiResource<ParasutContactAttributes> {
    return {
      type: 'contacts',
      attributes: {
        name: request.name,
        email: request.email,
        phone: request.phone,
        tax_number: request.taxNumber,
        tax_office: request.taxOffice,
        address: request.address,
        city: request.city,
        district: request.district,
        account_type: 'customer',
      },
    };
  }

  static toPaymentResource(
    request: AccountingPaymentRequest,
  ): ParasutJsonApiResource<ParasutPaymentAttributes> {
    return {
      type: 'payments',
      attributes: {
        date: request.paymentDate,
        amount: request.amount,
        description: request.notes || `Tahsilat Ref: ${request.referenceCode}`,
        payment_type: request.paymentMethod || 'credit_card',
      },
      relationships: {
        payable: {
          data: {
            id: request.invoiceExternalId,
            type: 'sales_invoices',
          },
        },
      },
    };
  }

  static toProductResource(
    request: AccountingProductRequest,
  ): ParasutJsonApiResource<ParasutProductAttributes> {
    return {
      type: 'products',
      attributes: {
        name: request.name,
        code: request.code || request.sku,
        vat_rate: request.vatRate || 20,
        currency: request.currency || 'TRY',
        list_price: request.unitPrice || 0,
        inventory_tracking: false, // Stock sync is disabled in Paraşüt
      },
    };
  }
}
