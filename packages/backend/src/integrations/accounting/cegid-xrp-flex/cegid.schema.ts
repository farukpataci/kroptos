import { Injectable, Logger } from '@nestjs/common';
import { CegidSchemaValidationResult } from './cegid.types';

/**
 * Zorunlu KroptOS Sözleşme Varlıkları ve Alanları (§6.2)
 */
export const CEGID_REQUIRED_SCHEMA: Record<string, string[]> = {
  Customer: ['CustomerID', 'CustomerName', 'MainContact'],
  SalesInvoice: ['ReferenceNbr', 'CustomerID', 'Type', 'Hold', 'Details'],
  Payment: ['ReferenceNbr', 'CustomerID', 'PaymentAmount'],
};

@Injectable()
export class CegidSchemaService {
  private readonly logger = new Logger(CegidSchemaService.name);

  /**
   * Sağlanan sözleşme şemasını zorunlu KroptOS gereksinimlerine göre doğrular (§6.2).
   */
  validateSchema(
    discoveredEntities: Record<string, string[]>,
  ): CegidSchemaValidationResult {
    const missingEntities: string[] = [];
    const missingFields: Record<string, string[]> = {};

    for (const [entityName, requiredFields] of Object.entries(
      CEGID_REQUIRED_SCHEMA,
    )) {
      const entityFields = discoveredEntities[entityName];
      if (!entityFields) {
        missingEntities.push(entityName);
        continue;
      }

      const missingInEntity = requiredFields.filter(
        (field) => !entityFields.includes(field),
      );

      if (missingInEntity.length > 0) {
        missingFields[entityName] = missingInEntity;
      }
    }

    const valid =
      missingEntities.length === 0 && Object.keys(missingFields).length === 0;

    if (!valid) {
      this.logger.warn(
        `[CegidSchema] Şema doğrulama başarısız! Eksik varlıklar: [${missingEntities.join(
          ', ',
        )}], Eksik alanlar: ${JSON.stringify(missingFields)}`,
      );
    }

    return {
      valid,
      missingEntities,
      missingFields,
    };
  }
}
