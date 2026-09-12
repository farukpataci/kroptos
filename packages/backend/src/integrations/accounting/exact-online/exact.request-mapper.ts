import {
  AccountingInvoiceContact,
  AccountingInvoiceItem,
  AccountingInvoiceRequest,
} from '../core/AccountingTypes';
import {
  ExactAccount,
  ExactSalesInvoice,
  ExactSalesInvoiceLine,
} from './exact.types';

export class ExactRequestMapper {
  /**
   * KroptOS fatura talebini Exact Online SalesInvoices ve SalesInvoiceLines yapısına dönüştürür.
   * Sunucu tarafından satırlardan hesaplanan genel toplamlar (AmountDC, VATAmountDC) gönderilmez.
   */
  static toSalesInvoice(
    request: AccountingInvoiceRequest,
    customerId: string, // Exact Online Account GUID
  ): Partial<ExactSalesInvoice> {
    const lines: ExactSalesInvoiceLine[] = (request.items || []).map(
      (item: AccountingInvoiceItem, idx: number) => {
        const vatCode = this.resolveVatCode(item.vatRate);
        const line: ExactSalesInvoiceLine = {
          LineNumber: idx + 1,
          ItemDescription: item.name,
          Quantity: item.quantity,
          UnitPrice: item.unitPrice,
          VATCode: vatCode,
          VATPercentage: item.vatRate,
        };

        // Eğer item SKU bir GUID gibi duruyorsa veya eşlenmişse Item alanına verilebilir
        if (item.sku && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.sku)) {
          line.Item = item.sku;
        }

        return line;
      },
    );

    const invoicePayload: Partial<ExactSalesInvoice> = {
      OrderedBy: customerId,
      InvoiceDate: request.issueDate,
      DueDate: request.dueDate,
      YourRef: request.referenceCode, // §5.8: Müşteri sipariş referansı
      Description: request.notes || `KroptOS Sipariş Faturası: ${request.referenceCode}`,
      Currency: request.currency || 'EUR',
      SalesInvoiceLines: lines,
    };

    return invoicePayload;
  }

  /**
   * KroptOS iletişim/cari bilgisini Exact Online Account (Cari Hesap) modeline çevirir.
   */
  static toAccount(contact: AccountingInvoiceContact): Partial<ExactAccount> {
    return {
      Name: contact.name,
      IsCustomer: true,
      IsSupplier: false,
      Email: contact.email,
      Phone: contact.phone,
      AddressLine1: contact.address,
      City: contact.city,
      Country: 'NL', // Varsayılan Benelux / Hollanda
      VATNumber: contact.taxNumber,
      Status: 'C', // Customer
    };
  }

  /**
   * KDV oranına göre Benelux/Exact Online KDV kodu eşler.
   * Hollanda standartları: 21% (Hoog), 9% (Laag), 0% (Nul)
   */
  private static resolveVatCode(vatRate: number): string {
    if (vatRate === 21) return '2'; // Standart Yüksek (Hoog)
    if (vatRate === 9) return '1';  // İndirimli (Laag)
    if (vatRate === 0) return '0';  // Sıfır / Muaf
    if (vatRate === 20) return '20'; // Standart UK/FR
    return String(vatRate);
  }
}
