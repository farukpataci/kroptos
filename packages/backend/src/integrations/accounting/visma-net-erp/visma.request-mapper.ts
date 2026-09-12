import { AccountingInvoiceRequest } from '../core/AccountingTypes';
import {
  VismaCustomerConfig,
  VismaCustomerInvoiceDto,
  VismaInvoiceLineDto,
} from './visma.types';

export class VismaRequestMapper {
  /**
   * Convert KroptOS invoice request to Visma CustomerInvoice DTO (§5.4, §5.6).
   * Throws explicit configuration error if required customer account/tax settings are missing.
   */
  static toCustomerInvoiceDto(
    request: AccountingInvoiceRequest,
    config: VismaCustomerConfig,
  ): VismaCustomerInvoiceDto {
    if (!config.incomeAccount?.trim()) {
      throw new Error(
        'Visma.net ERP faturası gönderilemedi: Varsayılan gelir hesabı kodu (incomeAccount) yapılandırılmamış. Lütfen firma/entegrasyon ayarlarından hesap kodunu belirleyin.',
      );
    }
    if (!config.vatCodeId?.trim()) {
      throw new Error(
        'Visma.net ERP faturası gönderilemedi: Varsayılan vergi kodu (vatCodeId) yapılandırılmamış. Lütfen firma/entegrasyon ayarlarından vergi kodunu belirleyin.',
      );
    }

    const docDate = request.issueDate
      ? new Date(request.issueDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const lines: VismaInvoiceLineDto[] = (request.items || []).map((item, index) => {
      const line: VismaInvoiceLineDto = {
        operation: 'Insert',
        lineNumber: { value: index + 1 },
        description: { value: item.name || `Ürün ${index + 1}` },
        quantity: { value: item.quantity },
        unitPriceInCurrency: { value: item.unitPrice },
        accountNumber: { value: config.incomeAccount!.trim() },
        vatCodeId: { value: config.vatCodeId!.trim() },
      };

      if (item.sku?.trim()) {
        line.inventoryNumber = { value: item.sku.trim() };
      }

      if (config.branchNumber?.trim()) {
        line.branchNumber = { value: config.branchNumber.trim() };
      }

      return line;
    });

    const dto: VismaCustomerInvoiceDto = {
      documentType: { value: 'Invoice' },
      documentDate: { value: docDate },
      customerNumber: { value: request.contact?.taxNumber || request.contact?.id || '10000' },
      customerRefNo: { value: request.referenceCode },
      invoiceText: { value: `KroptOS Sipariş: ${request.referenceCode}` },
      invoiceLines: lines,
    };

    if (request.currency) {
      dto.currencyId = { value: request.currency.toUpperCase() };
    }

    return dto;
  }
}
