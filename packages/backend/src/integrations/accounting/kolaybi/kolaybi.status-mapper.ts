export type KroptosDocumentStatus = 'pending' | 'created' | 'failed' | 'cancelled';

export class KolaybiStatusMapper {
  static toKroptosStatus(kolaybiStatus?: string | null): KroptosDocumentStatus {
    if (!kolaybiStatus) return 'pending';
    const normalized = kolaybiStatus.toLowerCase().trim();

    switch (normalized) {
      case 'draft':
      case 'ready_to_send':
        return 'pending';
      case 'sent':
      case 'approved':
        return 'created';
      case 'rejected':
        return 'failed';
      case 'cancelled':
      case 'canceled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}
