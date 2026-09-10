import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import {
  XeroContact,
  XeroInvoice,
  XeroItem,
  XeroLineItem,
  XeroPayment,
} from './xero.types';

export class XeroRequestMapper {
  /**
   * Resolves appropriate Xero TaxType from numeric VAT rate.
   */
  static mapVatRateToTaxType(vatRate: number): string {
    if (vatRate === 0) {
      return 'ZERORATED';
    }
    if (vatRate === 20) {
      return 'OUTPUT2';
    }
    // Default standard rate for UK/Global
    return 'OUTPUT2';
  }

  /**
   * Maps KroptOS generic invoice request to Xero ACCREC Invoice.
   * By default creates with status 'DRAFT' for 3-step calculation & reconciliation flow.
   */
  static toXeroInvoice(
    req: AccountingInvoiceRequest,
    accountCode: string = '200',
    status: 'DRAFT' | 'AUTHORISED' = 'DRAFT',
  ): XeroInvoice {
    const lineItems: XeroLineItem[] = req.items.map((item) => {
      const lineItem: XeroLineItem = {
        Description: item.name,
        Quantity: item.quantity,
        UnitAmount: Number(item.unitPrice.toFixed(4)), // Supports 4 decimal precision
        TaxType: XeroRequestMapper.mapVatRateToTaxType(item.vatRate),
        TaxAmount: item.vatAmount,
        LineAmount: Number((item.quantity * item.unitPrice).toFixed(2)),
        AccountCode: accountCode,
      };
      if (item.sku) {
        lineItem.ItemCode = item.sku;
      }
      return lineItem;
    });

    const contact: XeroContact = {
      Name: req.contact.name,
    };
    if (req.contact.taxNumber) {
      contact.TaxNumber = req.contact.taxNumber;
    }
    if (req.contact.email) {
      contact.EmailAddress = req.contact.email;
    }
    if (req.contact.address || req.contact.city) {
      contact.Addresses = [
        {
          AddressType: 'STREET',
          AddressLine1: req.contact.address || '',
          City: req.contact.city || '',
        },
      ];
    }

    return {
      Type: 'ACCREC',
      Contact: contact,
      Date: req.issueDate,
      DueDate: req.dueDate || req.issueDate,
      LineAmountTypes: 'Exclusive',
      Status: status,
      Reference: req.referenceCode,
      CurrencyCode: req.currency,
      LineItems: lineItems,
    };
  }

  /**
   * Maps generic contact request to Xero contact
   */
  static toXeroContact(req: AccountingContactRequest): XeroContact {
    const contact: XeroContact = {
      Name: req.name,
      ContactNumber: req.kroptosKey,
      IsCustomer: true,
    };

    if (req.taxNumber) {
      contact.TaxNumber = req.taxNumber;
    }
    if (req.email) {
      contact.EmailAddress = req.email;
    }
    if (req.phone) {
      contact.Phones = [
        {
          PhoneType: 'DEFAULT',
          PhoneNumber: req.phone,
        },
      ];
    }
    if (req.address || req.city) {
      contact.Addresses = [
        {
          AddressType: 'STREET',
          AddressLine1: req.address || '',
          City: req.city || '',
        },
      ];
    }

    return contact;
  }

  /**
   * Maps generic product request to Xero Item
   */
  static toXeroItem(req: AccountingProductRequest, defaultAccountCode: string = '200'): XeroItem {
    return {
      Code: req.sku,
      Name: req.name,
      IsSold: true,
      SalesDetails: {
        UnitPrice: req.unitPrice !== undefined ? Number(req.unitPrice.toFixed(4)) : undefined,
        AccountCode: defaultAccountCode,
        TaxType: req.vatRate !== undefined ? XeroRequestMapper.mapVatRateToTaxType(req.vatRate) : 'OUTPUT2',
      },
    };
  }

  /**
   * Maps generic payment request to Xero Payment
   */
  static toXeroPayment(
    req: AccountingPaymentRequest,
    bankAccountCode: string = '090',
  ): XeroPayment {
    return {
      Invoice: {
        InvoiceID: req.invoiceExternalId,
      },
      Account: {
        Code: req.accountId || bankAccountCode,
      },
      Date: req.paymentDate,
      Amount: req.amount,
      Reference: req.referenceCode,
      Status: 'AUTHORISED',
    };
  }
}
