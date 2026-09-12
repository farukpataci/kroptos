import { BadRequestException } from '@nestjs/common';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';
import { FreeAgentUriHelper } from './freeagent.uri';
import {
  FreeAgentEnvironment,
  FreeAgentInvoice,
  FreeAgentInvoiceItem,
} from './freeagent.types';

export interface FreeAgentRequestMapperOptions {
  environment: FreeAgentEnvironment;
  defaultCategoryUrl?: string;
  categoryMappings?: Record<string, string>; // sku/productKey -> category URI
}

export class FreeAgentRequestMapper {
  /**
   * §5.3 & §3 KroptOS Fatura İsteğini FreeAgent Fatura Payload'ına dönüştürür.
   *
   * KRİTİK KURALLAR:
   * 1. HESAPLANAN ALANLAR GÖNDERİLMEZ (§5.3):
   *    net_value, sales_tax_value, total_value, paid_value, due_value sunucu tarafından hesaplanır;
   *    giden istekte KESİNLİKLE yer alamaz.
   * 2. İLİŞKİLER TAM URL (§5.1):
   *    contact alanı FreeAgentUriHelper ile ortam bazlı tam URI olarak üretilir.
   * 3. GELİR KATEGORİSİ ZORUNLUDUR (§3):
   *    Ürün kaleminde kategori URI'si yoksa ve varsayılan kategori tanımlanmamışsa
   *    fatura gönderilmez, hata fırlatılır. Varsayılan uydurulamaz.
   * 4. İKİNCİ VERGİ UYDURULMAZ (§5.4):
   *    second_sales_tax_rate gönderilmez; sıfır uydurulmaz.
   */
  static toCreateInvoice(
    request: AccountingInvoiceRequest,
    options: FreeAgentRequestMapperOptions,
  ): Partial<FreeAgentInvoice> {
    const contactId = request.contact?.id || request.contact?.taxNumber || '1';
    const contactUri = FreeAgentUriHelper.buildResourceUri(
      'contacts',
      contactId,
      options.environment,
    );

    const datedOn = request.issueDate || new Date().toISOString().split('T')[0];
    const dueOn = request.dueDate || datedOn;

    const items: FreeAgentInvoiceItem[] = (request.items || []).map((item, idx) => {
      // Kategori URI çözümü (§3)
      const mappedCategory =
        options.categoryMappings?.[item.sku] ||
        options.categoryMappings?.[item.name] ||
        options.defaultCategoryUrl;

      if (!mappedCategory) {
        throw new BadRequestException(
          `[FreeAgent RequestMapper] Kalem #${idx + 1} (${item.name || item.sku}) için gelir kategorisi eşleştirmesi seçilmemiştir (§3). FreeAgent'ta her fatura satırı geçerli bir muhasebe kategorisi URI'sine bağlı olmak zorundadır.`,
        );
      }

      // Kategori URI formatı ve host doğrulaması
      FreeAgentUriHelper.validateHost(mappedCategory, options.environment);

      const taxRate = typeof item.vatRate === 'number' ? item.vatRate : 20;

      const invoiceItem: FreeAgentInvoiceItem = {
        description: item.name || item.sku || `Kalem #${idx + 1}`,
        item_type: 'Services',
        price: item.unitPrice,
        quantity: Math.max(1, item.quantity || 1),
        category: mappedCategory,
        sales_tax_rate: taxRate,
        // §5.4: second_sales_tax_rate GÖNDERİLMEZ (uydurma sıfır yok)
      };

      return invoiceItem;
    });

    // Boş kalem fallback kontrolü
    if (items.length === 0) {
      if (!options.defaultCategoryUrl) {
        throw new BadRequestException(
          '[FreeAgent RequestMapper] Fatura kalemi bulunamadı ve varsayılan gelir kategorisi URI tanımlanmamış (§3).',
        );
      }
      items.push({
        description: 'Genel Hizmet Bedeli',
        item_type: 'Services',
        price: request.grandTotal,
        quantity: 1,
        category: options.defaultCategoryUrl,
        sales_tax_rate: 20,
      });
    }

    const payload: Partial<FreeAgentInvoice> = {
      contact: contactUri,
      dated_on: datedOn,
      due_on: dueOn,
      currency: request.currency || 'GBP',
      comments: request.notes,
      po_reference: request.referenceCode, // §5.9 Harici sipariş referansı
      invoice_items: items,
      // NOT: net_value, total_value, sales_tax_value vb. ALANLAR KESİNLİKLE EKLENMEZ (§5.3)!
    };

    return payload;
  }
}
