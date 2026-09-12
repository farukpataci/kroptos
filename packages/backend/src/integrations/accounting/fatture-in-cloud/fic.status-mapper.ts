/**
 * Fatture in Cloud (TeamSystem) Status Separation & Mapping
 * Reference: §5.2
 *
 * CRITICAL ARCHITECTURAL BOUNDARY (§5.2):
 * A document has TWO INDEPENDENT STATUS AXES:
 * 1. KroptOS Document Status: pending | sent | failed | cancelled | cancel_failed
 *    (Reflects whether the document was successfully created in the accounting system)
 * 2. FIC EiStatus: attempt ... manual_rejected (14 values)
 *    (Reflects whether the document was transmitted to SdI tax authority)
 *
 * THE "SENT" TRAP:
 * FIC's 'sent' means "transmitted to SdI".
 * KroptOS's 'sent' means "created in accounting provider".
 * SAME WORD, TOTALLY DIFFERENT MEANING.
 *
 * ei_status MUST NEVER BE MAPPED to KroptOS document status!
 */

import { AccountingDocumentStatus } from '../core/AccountingTypes';
import { FIC_EI_STATUSES, FicEiStatus } from './fic.types';

export class FicStatusMapper {
  /**
   * Maps document creation state to KroptOS AccountingDocumentStatus.
   * If documentId is present and creation succeeded -> 'created' / 'sent'
   */
  static toKroptosDocumentStatus(documentId?: number | string): AccountingDocumentStatus {
    if (documentId) {
      return 'created'; // Maps to created/sent in KroptOS
    }
    return 'pending';
  }

  /**
   * Validates and sanitizes raw ei_status from FIC response.
   * Unknown status values are preserved verbatim without interpretation (§5.2).
   */
  static sanitizeEiStatus(rawEiStatus?: string | null): string {
    if (!rawEiStatus || !rawEiStatus.trim()) {
      return 'not_sent';
    }

    const trimmed = rawEiStatus.trim();
    if (FIC_EI_STATUSES.includes(trimmed as FicEiStatus)) {
      return trimmed;
    }

    // Preserve unknown future status verbatim
    return trimmed;
  }

  /**
   * Explains ei_status in human-readable terms for the operator interface.
   */
  static getEiStatusDescription(eiStatus: string): string {
    switch (eiStatus) {
      case 'attempt':
        return 'İletim Denemesi Yapılıyor';
      case 'missing':
        return 'E-Fatura Verisi Eksik';
      case 'not_sent':
        return 'SdI’ya Gönderilmedi (Fatture in Cloud üzerinde hazır)';
      case 'sent':
        return 'SdI’ya İletildi';
      case 'pending':
        return 'SdI Onayı Bekleniyor';
      case 'processing':
        return 'SdI İşlemde';
      case 'error':
        return 'İletim Hatası';
      case 'discarded':
        return 'SdI Tarafından Reddedildi / İptal';
      case 'not_delivered':
        return 'Alıcıya Teslim Edilemedi';
      case 'accepted':
        return 'SdI Tarafından Kabul Edildi';
      case 'rejected':
        return 'Alıcı Tarafından Reddedildi';
      case 'no_response':
        return 'SdI Yanıt Vermedi';
      case 'manual_accepted':
        return 'Manuel Kabul Edildi';
      case 'manual_rejected':
        return 'Manuel Reddedildi';
      default:
        return `Durum: ${eiStatus}`;
    }
  }
}
