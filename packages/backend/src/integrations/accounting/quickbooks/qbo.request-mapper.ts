import {
  AccountingContactRequest,
  AccountingInvoiceContact,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import { QBODocNumber } from './qbo.doc-number';
import { QBOTaxConfiguration, QBOTaxManager } from './qbo.tax';
import {
  QBOCustomer,
  QBOInvoice,
  QBOItem,
  QBOLine,
  QBOPayment,
  QBOPaymentLine,
} from './qbo.types';
import { AccountingAmountMismatchError } from '../core/AccountingErrors';

export class QBORequestMapper {
  /**
   * §4.5, §4.6, §4.9 Converts canonical KroptOS invoice request to QBO Invoice payload.
   */
  static toQBOInvoice(
    req: AccountingInvoiceRequest,
    customerId: string,
    taxConfig: QBOTaxConfiguration,
    currencyCode: string = 'USD',
  ): QBOInvoice {
    const docNumber = QBODocNumber.format(req.referenceCode);

    // 1. Build and validate invoice lines
    const lines: QBOLine[] = req.items.map((item, index) => {
      const lineNum = index + 1;
      const qty = item.quantity;
      const unitPrice = item.unitPrice;
      const discount = item.discountAmount || 0;
      const netLineAmount = +(qty * unitPrice - discount).toFixed(2);
      const grossLineAmount = +(netLineAmount + (item.vatAmount || 0)).toFixed(2);
      const actualLineAmount = +(item.totalAmount).toFixed(2);

      // §4.9 Step 1: Pre-validation of line amounts (supports net or gross representation)
      const matchesNet = Math.abs(netLineAmount - actualLineAmount) <= 0.05;
      const matchesGross = Math.abs(grossLineAmount - actualLineAmount) <= 0.05;

      if (!matchesNet && !matchesGross) {
        throw new AccountingAmountMismatchError(
          `Satır ${lineNum} tutar tutarsızlığı: Miktar (${qty}) × Birim Fiyat (${unitPrice}) - İndirim (${discount}) = ${netLineAmount}, fakat satır toplamı ${actualLineAmount}. Fatura gönderimi durduruldu.`,
        );
      }

      const taxCodeRef = QBOTaxManager.resolveLineTaxCode(taxConfig, item.vatRate);

      return {
        LineNum: lineNum,
        Description: item.name || item.sku,
        Amount: netLineAmount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          UnitPrice: unitPrice,
          Qty: qty,
          TaxCodeRef: taxCodeRef,
          ItemRef: item.sku ? { value: item.sku, name: item.name } : undefined,
        },
      };
    });

    const invoice: QBOInvoice = {
      DocNumber: docNumber,
      TxnDate: req.issueDate ? req.issueDate.split('T')[0] : new Date().toISOString().split('T')[0],
      DueDate: req.dueDate ? req.dueDate.split('T')[0] : undefined,
      CustomerRef: { value: customerId },
      Line: lines,
      // Full KroptOS reference audit trail in CustomerMemo and PrivateNote
      CustomerMemo: { value: `KroptOS Ref: ${req.referenceCode}` },
      PrivateNote: `KroptOS Ref: ${req.referenceCode} | DocNumber: ${docNumber}`,
      CurrencyRef: { value: req.currency || currencyCode },
    };

    // §4.6: If Automatic Sales Tax (AST) is NOT active, attach manual TxnTaxDetail
    if (!taxConfig.automaticSalesTax && taxConfig.usingSalesTax && req.vatTotal !== undefined) {
      invoice.TxnTaxDetail = {
        TxnTaxCodeRef: { value: taxConfig.defaultTaxCodeRef || 'NON' },
        TotalTax: +(req.vatTotal).toFixed(2),
      };
    }

    return invoice;
  }

  /**
   * Maps contact to QBO Customer.
   */
  static toQBOCustomer(contact: AccountingInvoiceContact | AccountingContactRequest): QBOCustomer {
    const name = contact.name || 'Bilinmeyen Müşteri';
    return {
      DisplayName: name,
      CompanyName: (contact as any).title || undefined,
      PrimaryEmailAddr: contact.email ? { Address: contact.email } : undefined,
      PrimaryPhone: contact.phone ? { FreeFormNumber: contact.phone } : undefined,
      TaxIdentifier: contact.taxNumber || undefined,
      BillAddr: contact.address
        ? {
            Line1: contact.address,
            City: contact.city,
            CountrySubDivisionCode: contact.district,
            PostalCode: (contact as any).postalCode,
            Country: (contact as any).country || 'US',
          }
        : undefined,
    };
  }

  /**
   * Maps payment to QBO Payment.
   */
  static toQBOPayment(
    req: AccountingPaymentRequest,
    customerId: string,
    depositAccountId?: string,
  ): QBOPayment {
    const lines: QBOPaymentLine[] = [];
    if (req.invoiceExternalId) {
      lines.push({
        Amount: req.amount,
        LinkedTxn: [{ TxnId: req.invoiceExternalId, TxnType: 'Invoice' }],
      });
    }

    return {
      CustomerRef: { value: customerId },
      TotalAmt: req.amount,
      TxnDate: req.paymentDate ? req.paymentDate.split('T')[0] : new Date().toISOString().split('T')[0],
      PaymentRefNum: req.referenceCode,
      DepositToAccountRef: depositAccountId ? { value: depositAccountId } : undefined,
      Line: lines.length > 0 ? lines : undefined,
    };
  }

  /**
   * Maps product mapping request to QBO Item.
   */
  static toQBOItem(
    req: AccountingProductRequest,
    incomeAccountId?: string,
  ): QBOItem {
    return {
      Name: req.name,
      Sku: req.sku || req.code,
      Type: 'NonInventory',
      UnitPrice: req.unitPrice || 0,
      IncomeAccountRef: incomeAccountId ? { value: incomeAccountId } : undefined,
    };
  }
}
