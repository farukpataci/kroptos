import { OdooMoveState } from './odoo.types';

export type KroptosDocumentStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'cancel_failed';

/**
 * Odoo Invoice Status Mapper (§6)
 *
 * Conservative Mapping Rule:
 * - draft -> 'pending'
 * - posted -> 'sent'
 * - cancel -> 'cancelled'
 * - unknown / unparseable -> 'pending' (NEVER sent or cancelled)
 */
export class OdooStatusMapper {
  static toKroptosStatus(odooState?: OdooMoveState | string): KroptosDocumentStatus {
    if (!odooState) return 'pending';

    const normalized = odooState.toLowerCase().trim();
    switch (normalized) {
      case 'posted':
        return 'sent';
      case 'cancel':
      case 'cancelled':
        return 'cancelled';
      case 'draft':
        return 'pending';
      default:
        // §6: Conservative fallback
        return 'pending';
    }
  }
}
