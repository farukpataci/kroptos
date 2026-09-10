export type KroptosDocumentStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'cancel_failed';

/**
 * §9 Rule 18: Sage Status Mapper
 *
 * DRAFT                    -> pending
 * UNPAID, PART_PAID, PAID  -> sent
 * VOID, CANCELLED          -> cancelled
 * Bilinmeyen / Boş         -> pending (ASLA sent veya cancelled olamaz)
 */
export class SageStatusMapper {
  static toKroptosStatus(statusId?: string | null): KroptosDocumentStatus {
    if (!statusId) {
      return 'pending';
    }

    const normalized = statusId.trim().toUpperCase();

    switch (normalized) {
      case 'DRAFT':
        return 'pending';

      case 'UNPAID':
      case 'PART_PAID':
      case 'PAID':
        return 'sent';

      case 'VOID':
      case 'CANCELLED':
        return 'cancelled';

      default:
        // Rule 18: Fallback to pending for unknown statuses; NEVER sent or cancelled
        return 'pending';
    }
  }
}
