import { BadRequestException } from '@nestjs/common';

/**
 * NetSuite URI ve Host Yönetişimi Yardımcısı (§2.1, §5.1)
 *
 * KRİTİK KURALLAR:
 * 1. Taban URL koda GÖMÜLMEZ; accountId parametresinden üretilir (Oracle Talimatı).
 * 2. Sandbox hesap kimliği dönüşümü:
 *    - Alt çizgiler (_) tireye (-) dönüştürülür.
 *    - Tümü küçük harfe (lowercase) çevrilir.
 *    - Örn: "1234567_SB1" -> "1234567-sb1.suitetalk.api.netsuite.com"
 * 3. Giden her isteğin host'u, yapılandırılmış hesaptan beklenen host ile katı biçimde doğrulanır.
 * 4. Mapper'larda veya servislerde string birleştirme (+ veya template literal) YASAKTIR.
 */
export class NetSuiteUriHelper {
  private static readonly SUITETALK_DOMAIN = 'suitetalk.api.netsuite.com';

  /**
   * Hesap kimliğinden standart NetSuite hostname'ini üretir (§2.1, §3.a, §5.1)
   */
  static getExpectedHost(accountId: string): string {
    if (!accountId || typeof accountId !== 'string') {
      throw new BadRequestException('[NetSuite URI] Geçersiz veya boş hesap kimliği (accountId).');
    }

    const trimmed = accountId.trim();
    if (!trimmed) {
      throw new BadRequestException('[NetSuite URI] Hesap kimliği (accountId) boş olamaz.');
    }

    // Güvenlik doğrulaması: Hesap kimliği yalnızca alfanumerik ve altçizgi/tire içerebilir
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      throw new BadRequestException(
        `[NetSuite URI] Hesap kimliği geçersiz karakterler içeriyor: "${trimmed}". Yalnızca alfasayısal, tire ve alt çizgi kabul edilir.`,
      );
    }

    // Doğrulanmış kural: alt çizgi -> tire, tümü küçük harf
    const normalizedId = trimmed.toLowerCase().replace(/_/g, '-');
    return `${normalizedId}.${this.SUITETALK_DOMAIN}`;
  }

  /**
   * Hesap kimliğinden taban API adresini üretir.
   */
  static getBaseUrl(accountId: string): string {
    const host = this.getExpectedHost(accountId);
    return `https://${host}`;
  }

  /**
   * OAuth 2.0 Token uç noktasını üretir (§2.1, §3.b).
   */
  static getTokenUrl(accountId: string): string {
    const baseUrl = this.getBaseUrl(accountId);
    return `${baseUrl}/services/rest/auth/oauth2/v1/token`;
  }

  /**
   * Metadata Catalog uç noktasını üretir (§2.1, §5.5).
   */
  static getMetadataCatalogUrl(accountId: string, select?: string): string {
    const baseUrl = this.getBaseUrl(accountId);
    const path = '/services/rest/record/v1/metadata-catalog';
    if (select) {
      return `${baseUrl}${path}?select=${encodeURIComponent(select)}`;
    }
    return `${baseUrl}${path}`;
  }

  /**
   * SuiteQL uç noktasını üretir (§2.1).
   */
  static getSuiteQLUrl(accountId: string, limit?: number, offset?: number): string {
    const baseUrl = this.getBaseUrl(accountId);
    const url = new URL(`${baseUrl}/services/rest/query/v1/suiteql`);
    if (limit !== undefined) url.searchParams.set('limit', String(limit));
    if (offset !== undefined) url.searchParams.set('offset', String(offset));
    return url.toString();
  }

  /**
   * Standart veya eid: formatında kayıt URI'si üretir (§2.1, §5.7).
   * Örn: "customer", 42 -> "https://<host>/services/rest/record/v1/customer/42"
   * Örn: "invoice", "eid:INV-2026-001" -> "https://<host>/services/rest/record/v1/invoice/eid:INV-2026-001"
   */
  static buildRecordUrl(
    accountId: string,
    recordType: 'customer' | 'invoice' | 'customerPayment' | 'inventoryItem' | string,
    idOrExternalId?: string | number,
  ): string {
    const baseUrl = this.getBaseUrl(accountId);
    const cleanType = encodeURIComponent(recordType.trim());

    if (idOrExternalId === undefined || idOrExternalId === null || String(idOrExternalId).trim() === '') {
      return `${baseUrl}/services/rest/record/v1/${cleanType}`;
    }

    const rawId = String(idOrExternalId).trim();
    if (rawId.startsWith('eid:')) {
      const eidValue = rawId.substring(4);
      return `${baseUrl}/services/rest/record/v1/${cleanType}/eid:${encodeURIComponent(eidValue)}`;
    }

    return `${baseUrl}/services/rest/record/v1/${cleanType}/${encodeURIComponent(rawId)}`;
  }

  /**
   * §5.1 Hedef URL'in protokolünü ve host'unu yapılandırılmış hesaba göre KATI şekilde doğrular.
   * API cevaplarından gelen adreslere körlemesine istek atılmasını (SSRF / yetkisiz host) engeller.
   */
  static validateHost(targetUrl: string, accountId: string): URL {
    if (!targetUrl || typeof targetUrl !== 'string') {
      throw new BadRequestException('[NetSuite URI] Geçersiz veya boş URL.');
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl.trim());
    } catch {
      throw new BadRequestException(`[NetSuite URI] URL ayrıştırılamadı: ${targetUrl}`);
    }

    // Yalnızca HTTPS protokolüne izin verilir
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException(
        `[NetSuite URI] Güvenlik ihlali: Sadece HTTPS protokolü desteklenir, gelen: "${parsed.protocol}"`,
      );
    }

    const expectedHost = this.getExpectedHost(accountId);

    // Host tam eşleşmeli, subdomain kaçışları veya yabancı hostlar engellenir
    if (parsed.hostname.toLowerCase() !== expectedHost.toLowerCase()) {
      throw new BadRequestException(
        `[NetSuite URI] Host güvenlik doğrulaması başarısız! Beklenen: "${expectedHost}", Gelen: "${parsed.hostname}". Yabancı host'lara veya başka hesap adreslerine istek atılamaz.`,
      );
    }

    return parsed;
  }

  /**
   * Verilen URL'in bu hesap ile eşleşip eşleşmediğini kontrol eder.
   */
  static isAccountMatch(url: string, accountId: string): boolean {
    try {
      this.validateHost(url, accountId);
      return true;
    } catch {
      return false;
    }
  }
}
