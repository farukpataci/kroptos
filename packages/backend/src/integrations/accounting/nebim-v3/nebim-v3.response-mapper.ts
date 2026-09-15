import { AccountingApiError } from '../core/AccountingErrors';
import { AccountingInvoiceResult, AccountingTestConnectionResult } from '../core/AccountingTypes';

/**
 * Nebim V3 cevap zarfı doğrulanmadı (§12/1, §12/2).
 * Savunmacı: tanımadığı şekli TAHMİN ETMEZ, hata fırlatır; boş dizi ya da sahte belge numarası dönmez (§11).
 */
export class NebimV3ResponseMapper {
  private static assertObject(raw: unknown, ctx: string): Record<string, unknown> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new AccountingApiError('NEBIM-V3', 502, `${ctx}: tanınmayan cevap zarfı (nesne bekleniyordu)`, raw);
    }
    return raw as Record<string, unknown>;
  }

  /**
   * Katalog sorgusu `nebim.invoice_by_ref` satırından belge referansı.
   */
  static toInvoiceResultFromCatalogRow(row: unknown, expectedRef: string): AccountingInvoiceResult {
    const r = NebimV3ResponseMapper.assertObject(row, 'invoice_by_ref');
    if (r.external_ref !== expectedRef) {
      throw new AccountingApiError(
        'NEBIM-V3',
        502,
        `invoice_by_ref: external_ref uyuşmuyor (${String(r.external_ref)} ≠ ${expectedRef})`,
        row,
      );
    }
    if (r.document_id === undefined || r.document_id === null || r.document_id === '') {
      throw new AccountingApiError('NEBIM-V3', 502, 'invoice_by_ref: document_id boş', row);
    }
    return {
      externalId: String(r.document_id),
      externalNumber: r.document_no === undefined || r.document_no === null ? undefined : String(r.document_no),
      rawResponse: r,
    };
  }

  /**
   * Yazma cevabı: belge kimliği veya evrak numarası bulunamıyorsa BAŞARI SAYILMAZ.
   */
  static toInvoiceResult(raw: unknown, externalRef: string): AccountingInvoiceResult {
    const r = NebimV3ResponseMapper.assertObject(raw, 'InvoicePush');
    const docId = r.DocumentID ?? r.documentId ?? r.InvoiceID ?? r.invoiceId;
    const docNo = r.DocumentNumber ?? r.documentNumber ?? r.InvoiceNumber ?? r.invoiceNumber;

    if (!docId && !docNo) {
      throw new AccountingApiError(
        'NEBIM-V3',
        502,
        `InvoicePush: evrak kimliği veya numarası cevapta bulunamadı (ref ${externalRef})`,
        raw,
      );
    }
    return {
      externalId: String(docId || docNo),
      externalNumber: docNo ? String(docNo) : undefined,
      rawResponse: r,
    };
  }

  static toTestConnectionResult(raw: unknown, companyNo: string): AccountingTestConnectionResult {
    const r = NebimV3ResponseMapper.assertObject(raw, 'Connect');
    const statusText = String(r.Status ?? r.status ?? '');
    const hasSession = Boolean(r.SessionID ?? r.sessionId);

    if (!hasSession && !/success/i.test(statusText)) {
      throw new AccountingApiError(
        'NEBIM-V3',
        401,
        `Nebim Connect başarısız: ${statusText || 'SessionID alınamadı'}`,
        r,
      );
    }

    return {
      success: true,
      message: 'Nebim V3 Connect bağlantısı başarılı (oturum açıldı)',
      companyId: companyNo,
      environment: 'TEST',
    };
  }
}
