/**
 * Business Central Status Mapper (§5.2)
 *
 * Mapping table:
 * Draft, In Review        -> pending    (henüz deftere işlenmedi)
 * Open, Paid              -> sent
 * Canceled, Corrective    -> cancelled
 * ""                      -> pending
 * bilinmeyen / yeni değer -> pending    (ASLA sent/cancelled değil)
 */

export type KroptosDocumentStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'cancel_failed';

export class BusinessCentralStatusMapper {
  static toKroptosStatus(bcStatus?: string | null): KroptosDocumentStatus {
    if (!bcStatus) {
      return 'pending';
    }

    const normalized = bcStatus.trim();

    switch (normalized) {
      case 'Draft':
      case 'In Review':
      case '':
        return 'pending';

      case 'Open':
      case 'Paid':
        return 'sent';

      case 'Canceled':
      case 'Corrective':
        return 'cancelled';

      default:
        // Unknown or future BC status -> strictly fallback to pending, NEVER sent or cancelled
        return 'pending';
    }
  }
}
