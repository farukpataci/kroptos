import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import {
  NetSuiteCredentials,
  NetSuiteMetadataCatalogSchema,
  NetSuiteSchemaDiscovery,
} from './netsuite.types';
import { NetSuiteUriHelper } from './netsuite.uri';

/**
 * KroptOS NetSuite Entegrasyonunun ihtiyaç duyduğu standart zorunlu alanlar (§5.5)
 */
export const NETSUITE_REQUIRED_RECORD_FIELDS: Record<string, string[]> = {
  customer: ['companyName', 'email', 'subsidiary'],
  invoice: ['entity', 'item', 'subsidiary'],
  customerPayment: ['customer', 'payment'],
};

/**
 * NetSuite Metadata Catalog Şema Keşif Yöneticisi (§5.5)
 *
 * KRİTİK İLKELER:
 * 1. Özel alanlar (custbody_*, custcol_*) ve özelleştirmeler hesaba göre değiştiği için alan adları varsayılmaz.
 * 2. Bağlantı testi veya keşif esnasında metadata-catalog uç noktalarından şema okunur.
 * 3. Zorunlu alanlar eksikse entegrasyon "doğrulanmadı" kalır ve eksik alan operatöre raporlanır.
 * 4. Bu turda yalnızca standart alanlar doğrulanır ve kullanılır.
 */
export class NetSuiteSchemaManager {
  /**
   * Mock / Test ortamında bilinen varsayılan şemayı döner
   */
  static getMockCatalogSchema(recordType: string): NetSuiteMetadataCatalogSchema {
    switch (recordType) {
      case 'customer':
        return {
          title: 'customer',
          type: 'object',
          properties: {
            id: { type: 'string', readOnly: true },
            entityId: { type: 'string', title: 'Customer ID' },
            companyName: { type: 'string', title: 'Company Name' },
            email: { type: 'string', title: 'Email' },
            phone: { type: 'string', title: 'Phone' },
            subsidiary: { type: 'object', title: 'Subsidiary' },
            externalId: { type: 'string', title: 'External ID' },
          },
          required: ['companyName', 'subsidiary'],
        };

      case 'invoice':
        return {
          title: 'invoice',
          type: 'object',
          properties: {
            id: { type: 'string', readOnly: true },
            entity: { type: 'object', title: 'Customer' },
            tranDate: { type: 'string', title: 'Date' },
            dueDate: { type: 'string', title: 'Due Date' },
            subsidiary: { type: 'object', title: 'Subsidiary' },
            currency: { type: 'object', title: 'Currency' },
            item: { type: 'object', title: 'Items' },
            externalId: { type: 'string', title: 'External ID' },
          },
          required: ['entity', 'item', 'subsidiary'],
        };

      case 'customerPayment':
        return {
          title: 'customerPayment',
          type: 'object',
          properties: {
            id: { type: 'string', readOnly: true },
            customer: { type: 'object', title: 'Customer' },
            payment: { type: 'number', title: 'Payment Amount' },
            tranDate: { type: 'string', title: 'Date' },
            subsidiary: { type: 'object', title: 'Subsidiary' },
            externalId: { type: 'string', title: 'External ID' },
          },
          required: ['customer', 'payment'],
        };

      default:
        return {
          title: recordType,
          type: 'object',
          properties: {},
          required: [],
        };
    }
  }

  /**
   * Belirtilen kayıt tiplerinin şemasını keşfeder ve doğrular (§5.5).
   */
  static async discoverSchema(
    credentials: NetSuiteCredentials,
    fetchRecordSchemaFn?: (recordType: string) => Promise<NetSuiteMetadataCatalogSchema>,
  ): Promise<NetSuiteSchemaDiscovery> {
    const recordsToInspect = ['customer', 'invoice', 'customerPayment'];
    const discoveredRecords: Record<string, { fields: string[]; requiredFields: string[] }> = {};
    const missingFields: string[] = [];

    for (const recordType of recordsToInspect) {
      let schema: NetSuiteMetadataCatalogSchema;

      if (fetchRecordSchemaFn) {
        try {
          schema = await fetchRecordSchemaFn(recordType);
        } catch (err: any) {
          missingFields.push(`${recordType} (Şema okunamadı: ${err?.message || 'Bilinmiyor'})`);
          continue;
        }
      } else {
        // Fetcher verilmediyse mock kataloğu kullanılır
        schema = this.getMockCatalogSchema(recordType);
      }

      const availableProperties = Object.keys(schema.properties || {});
      const requiredByNetSuite = schema.required || [];

      discoveredRecords[recordType] = {
        fields: availableProperties,
        requiredFields: requiredByNetSuite,
      };

      // KroptOS entegrasyonu için zorunlu alan kontrolü
      const requiredByKroptos = NETSUITE_REQUIRED_RECORD_FIELDS[recordType] || [];
      for (const reqField of requiredByKroptos) {
        if (!availableProperties.includes(reqField)) {
          missingFields.push(`${recordType}.${reqField}`);
        }
      }
    }

    const isValid = missingFields.length === 0;

    return {
      discoveredAt: new Date().toISOString(),
      accountId: credentials.accountId,
      records: discoveredRecords,
      missingRequiredFields: missingFields,
      isValid,
    };
  }

  /**
   * Keşif sonucunu kontrol eder; zorunlu alan eksikse IntegrationNotVerifiedError fırlatır.
   */
  static assertSchemaValid(discovery: NetSuiteSchemaDiscovery): void {
    if (!discovery.isValid || discovery.missingRequiredFields.length > 0) {
      throw new IntegrationNotVerifiedError(
        'netsuite',
        `NetSuite şema keşfi başarısız oldu! KroptOS için gerekli şu alanlar NetSuite hesabında bulunamadı: [${discovery.missingRequiredFields.join(
          ', ',
        )}]. Lütfen NetSuite yönetici rol izinlerini ve hesap özelleştirmelerini kontrol ediniz.`,
      );
    }
  }
}
