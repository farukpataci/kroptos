import { BadRequestException } from '@nestjs/common';
import { SevdeskObjectName, SevdeskRef } from './sevdesk.types';

export const VALID_SEVDESK_OBJECT_NAMES: ReadonlySet<string> = new Set<SevdeskObjectName>([
  'Invoice',
  'InvoicePos',
  'Contact',
  'ContactAddress',
  'Unity',
  'SevUser',
  'CheckAccount',
  'CheckAccountTransaction',
  'Order',
  'CreditNote',
  'Voucher',
  'Part',
  'Tag',
  'TaxRule',
  'TaxSet',
  'Category',
  'StaticCountry',
  'PaymentMethod',
]);

/**
 * §5.3 Central SevDesk Reference Helper:
 * Produces { id, objectName } envelope.
 * Strictly checks that objectName is in the valid set and id is non-empty.
 * Manual object creation in mappers is prohibited.
 */
export function createSevdeskRef<TName extends SevdeskObjectName>(
  objectName: TName,
  id: number | string,
): SevdeskRef<TName> {
  if (!objectName || !VALID_SEVDESK_OBJECT_NAMES.has(objectName)) {
    throw new BadRequestException(
      `[sevDesk Ref] Geçersiz veya izin verilmeyen objectName: '${String(objectName)}'. Yalnızca tanımlı sevDesk nesne tipleri kullanılabilir.`,
    );
  }

  if (id === undefined || id === null || String(id).trim() === '') {
    throw new BadRequestException(
      `[sevDesk Ref] '${objectName}' referansı için boş veya geçersiz ID verilemez.`,
    );
  }

  return {
    id: typeof id === 'number' ? id : String(id).trim(),
    objectName,
  };
}
