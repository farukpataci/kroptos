import { AccountingInvoiceRequest } from '../core/AccountingTypes';
import { createSevdeskRef } from './sevdesk.ref';
import { SevdeskInvoiceFactoryPayload } from './sevdesk.types';

export class SevdeskRequestMapper {
  /**
   * §5.1, §5.3, §5.4 Translates KroptOS invoice request to SevDesk Factory payload.
   * - Always created as Draft (100)
   * - All relations wrapped via createSevdeskRef
   * - External order reference set in customerInternalNote and header
   */
  static toCreateInvoice(request: AccountingInvoiceRequest): SevdeskInvoiceFactoryPayload {
    const contactId = request.contact?.id || request.contact?.taxNumber || '1000';
    const contactRef = createSevdeskRef('Contact', contactId);
    const unityRef = createSevdeskRef('Unity', '1'); // Standard piece/unit

    const invoiceDate = request.issueDate || new Date().toISOString().split('T')[0];

    const lines = (request.items || []).map((item) => {
      const taxRate = typeof item.vatRate === 'number' ? item.vatRate : 19; // German standard VAT is 19%
      return {
        objectName: 'InvoicePos' as const,
        name: item.name || item.sku || 'Ürün',
        quantity: Math.max(1, item.quantity || 1),
        price: item.unitPrice,
        taxRate,
        unity: unityRef,
      };
    });

    // Fallback if no lines provided
    if (lines.length === 0) {
      lines.push({
        objectName: 'InvoicePos' as const,
        name: 'Genel Satış Kalemi',
        quantity: 1,
        price: request.grandTotal,
        taxRate: 19,
        unity: unityRef,
      });
    }

    const reference = request.referenceCode || 'REF-SEVDESK';

    return {
      invoice: {
        objectName: 'Invoice',
        invoiceDate,
        header: `Fatura ${reference}`,
        customerInternalNote: `KroptOS Ref: ${reference}`,
        contact: contactRef,
        status: 100, // MANDATORY: Status 100 (Draft) (§5.1)
        invoiceType: 'RE',
        currency: request.currency || 'EUR',
      },
      invoicePosSave: lines,
      takeDefaultAddress: true,
    };
  }
}
