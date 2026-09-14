import { AccountingApiError } from '../core/AccountingErrors';
import { AccountingInvoiceResult, AccountingTestConnectionResult } from '../core/AccountingTypes';

/**
 * Mikro cevap zarfı DOĞRULANMADI (§12/2). Savunmacı: tanımadığı şekli TAHMİN ETMEZ, hata
 * fırlatır; boş dizi ya da sahte belge numarası DÖNMEZ (§11).
 */
export class MikroResponseMapper {
  private static assertObject(raw: unknown, ctx: string): Record<string, unknown> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new AccountingApiError('MIKRO', 502, `${ctx}: tanınmayan cevap zarfı (nesne bekleniyordu)`, raw);
    }
    return raw as Record<string, unknown>;
  }

  /**
   * Katalog sorgusu `mikro.invoice_by_ref` satırından belge referansı. Takma ad kolonları
   * (`external_ref`, `document_id`, `document_no`) manifest'te sabittir; eksikse
   * assertExpectedColumns zaten durdurmuştur — burada yine de tahmin yürütülmez.
   */
  static toInvoiceResultFromCatalogRow(row: unknown, expectedRef: string): AccountingInvoiceResult {
    const r = MikroResponseMapper.assertObject(row, 'invoice_by_ref');
    if (r.external_ref !== expectedRef) {
      throw new AccountingApiError('MIKRO', 502, `invoice_by_ref: external_ref uyuşmuyor (${String(r.external_ref)} ≠ ${expectedRef})`, row);
    }
    if (r.document_id === undefined || r.document_id === null || r.document_id === '') {
      throw new AccountingApiError('MIKRO', 502, 'invoice_by_ref: document_id boş', row);
    }
    return {
      externalId: String(r.document_id),
      externalNumber: r.document_no === undefined || r.document_no === null ? undefined : String(r.document_no),
      rawResponse: r,
    };
  }

  /** Yazma cevabı: belge kimliği/numarası bulunamıyorsa BAŞARI SAYILMAZ. */
  static toInvoiceResult(raw: unknown, externalRef: string): AccountingInvoiceResult {
    const r = MikroResponseMapper.assertObject(raw, 'FaturaKaydet');
    // Alan adı doğrulanmadı: yalnızca §3.4'te görülen evrak alanları tanınır
    const seri = r.cha_evrakno_seri;
    const sira = r.cha_evrakno_sira;
    if (typeof seri !== 'string' || (typeof sira !== 'number' && typeof sira !== 'string')) {
      throw new AccountingApiError('MIKRO', 502, `FaturaKaydet: evrak numarası cevapta bulunamadı (ref ${externalRef})`, raw);
    }
    return { externalId: `${seri}-${sira}`, externalNumber: `${seri}-${sira}`, rawResponse: r };
  }

  static toTestConnectionResult(raw: unknown, companyNo: string): AccountingTestConnectionResult {
    const r = MikroResponseMapper.assertObject(raw, 'APILogin');
    // Cevap şekli bilinmiyor; yalnızca dokümandaki hata metni tanınır (§3.2)
    const text = JSON.stringify(r);
    if (/Ge[cç]ersiz api key/i.test(text)) {
      throw new AccountingApiError('MIKRO', 401, 'Geçersiz api key', r);
    }
    return {
      success: true,
      message: 'Mikro APILogin cevabı alındı — zarf doğrulanmadı, alanlar yorumlanmadı',
      companyId: companyNo,
      environment: 'TEST',
    };
  }
}
