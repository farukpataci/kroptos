import { BadRequestException } from '@nestjs/common';

/**
 * Cegid XRP Flex URI ve Host Yönetişimi Yardımcısı (§2.a, §5.1, §6.1)
 *
 * KRİTİK KURALLAR:
 * 1. Taban URL koda GÖMÜLMEZ; instanceUrl parametresinden üretilir.
 * 2. Giden her isteğin host'u, yapılandırılmış örnek adresiyle katı biçimde doğrulanır (SSRF koruması).
 * 3. Acumatica Contract-Based REST API yol şeması:
 *    `/entity/{endpointName}/{endpointVersion}/{entityName}`
 * 4. Yalnızca HTTPS protokolü kabul edilir.
 */
export class CegidUriHelper {
  public static readonly DEFAULT_ENDPOINT_NAME = 'Default';
  public static readonly DEFAULT_ENDPOINT_VERSION = '22.200.001';

  /**
   * Verilen instanceUrl değerini temizler ve HTTPS protokolünü doğrular.
   */
  static cleanBaseUrl(instanceUrl: string): string {
    if (!instanceUrl || typeof instanceUrl !== 'string') {
      throw new BadRequestException(
        '[Cegid URI] Geçersiz veya boş örnek adresi (instanceUrl).',
      );
    }

    const trimmed = instanceUrl.trim();
    if (!trimmed) {
      throw new BadRequestException(
        '[Cegid URI] Örnek adresi (instanceUrl) boş olamaz.',
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException(
        `[Cegid URI] Örnek adresi geçerli bir URL değil: "${trimmed}"`,
      );
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException(
        `[Cegid URI] Güvenlik ihlali: Sadece HTTPS protokolü desteklenir, gelen: "${parsed.protocol}"`,
      );
    }

    return `${parsed.protocol}//${parsed.host}`;
  }

  /**
   * Yapılandırılmış örnek adresinden beklenen hostname'i döner.
   */
  static getExpectedHost(instanceUrl: string): string {
    const clean = this.cleanBaseUrl(instanceUrl);
    const parsed = new URL(clean);
    return parsed.hostname.toLowerCase();
  }

  /**
   * Hedef URL'in protokolünü ve hostname'ini yapılandırılmış örneğe karşı doğrular (§5.1, §6.1).
   * SSRF ve host kaçırma açıklarını engeller.
   */
  static validateHost(targetUrl: string, instanceUrl: string): URL {
    if (!targetUrl || typeof targetUrl !== 'string') {
      throw new BadRequestException('[Cegid URI] Geçersiz veya boş hedef URL.');
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl.trim());
    } catch {
      throw new BadRequestException(
        `[Cegid URI] Hedef URL ayrıştırılamadı: "${targetUrl}"`,
      );
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException(
        `[Cegid URI] Güvenlik ihlali: Sadece HTTPS protokolü kabul edilir, gelen: "${parsed.protocol}"`,
      );
    }

    const expectedHost = this.getExpectedHost(instanceUrl);
    if (parsed.hostname.toLowerCase() !== expectedHost) {
      throw new BadRequestException(
        `[Cegid URI] Host güvenlik doğrulaması başarısız! Beklenen: "${expectedHost}", Gelen: "${parsed.hostname}". Yabancı host'lara istek atılamaz.`,
      );
    }

    return parsed;
  }

  /**
   * OAuth 2.0 Token uç noktasını üretir (§2.b, §6.3).
   */
  static getTokenUrl(instanceUrl: string, customTokenUrl?: string): string {
    if (customTokenUrl && customTokenUrl.trim()) {
      const validated = this.validateHost(customTokenUrl, instanceUrl);
      return validated.toString();
    }
    const baseUrl = this.cleanBaseUrl(instanceUrl);
    return `${baseUrl}/identity/connect/token`;
  }

  /**
   * Acumatica Contract-Based REST Varlık URL'i üretir (§2.c, §3).
   * Format: `https://{host}/entity/{endpointName}/{endpointVersion}/{entityName}`
   */
  static buildContractUrl(
    instanceUrl: string,
    entityName: string,
    endpointName?: string,
    endpointVersion?: string,
    idOrKey?: string,
  ): string {
    const baseUrl = this.cleanBaseUrl(instanceUrl);
    const epName = encodeURIComponent(
      (endpointName && endpointName.trim()) || this.DEFAULT_ENDPOINT_NAME,
    );
    const epVer = encodeURIComponent(
      (endpointVersion && endpointVersion.trim()) ||
        this.DEFAULT_ENDPOINT_VERSION,
    );
    const cleanEntity = encodeURIComponent(entityName.trim());

    let path = `${baseUrl}/entity/${epName}/${epVer}/${cleanEntity}`;
    if (idOrKey !== undefined && idOrKey !== null && String(idOrKey).trim()) {
      path += `/${encodeURIComponent(String(idOrKey).trim())}`;
    }
    return path;
  }

  /**
   * Acumatica Contract Eylemi (Action) URL'i üretir (örn: ReleaseInvoice) (§2.e, §6.4).
   * Format: `https://{host}/entity/{endpointName}/{endpointVersion}/{entityName}/{actionName}`
   */
  static buildActionUrl(
    instanceUrl: string,
    entityName: string,
    actionName: string,
    endpointName?: string,
    endpointVersion?: string,
  ): string {
    const baseUrl = this.cleanBaseUrl(instanceUrl);
    const epName = encodeURIComponent(
      (endpointName && endpointName.trim()) || this.DEFAULT_ENDPOINT_NAME,
    );
    const epVer = encodeURIComponent(
      (endpointVersion && endpointVersion.trim()) ||
        this.DEFAULT_ENDPOINT_VERSION,
    );
    const cleanEntity = encodeURIComponent(entityName.trim());
    const cleanAction = encodeURIComponent(actionName.trim());

    return `${baseUrl}/entity/${epName}/${epVer}/${cleanEntity}/${cleanAction}`;
  }
}
