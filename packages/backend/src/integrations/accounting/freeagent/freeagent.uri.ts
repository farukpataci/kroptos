import { BadRequestException } from '@nestjs/common';
import {
  FREEAGENT_PRODUCTION_BASE_URL,
  FREEAGENT_SANDBOX_BASE_URL,
  FreeAgentEnvironment,
} from './freeagent.types';

export const ALLOWED_FREEAGENT_HOSTS = [
  'api.freeagent.com',
  'api.sandbox.freeagent.com',
] as const;

export type AllowedFreeAgentHost = (typeof ALLOWED_FREEAGENT_HOSTS)[number];

export class FreeAgentUriHelper {
  /**
   * Ortama göre resmî FreeAgent API taban adresini döner.
   */
  static getBaseUrl(environment: FreeAgentEnvironment): string {
    return environment === 'PRODUCTION'
      ? FREEAGENT_PRODUCTION_BASE_URL
      : FREEAGENT_SANDBOX_BASE_URL;
  }

  /**
   * Ortama göre beklenen host adını döner.
   */
  static getExpectedHost(environment: FreeAgentEnvironment): string {
    return environment === 'PRODUCTION'
      ? 'api.freeagent.com'
      : 'api.sandbox.freeagent.com';
  }

  /**
   * §5.1 Hedef URL'in protokolünü ve host'unu yapılandırılmış ortama göre katı şekilde doğrular.
   * API cevaplarından gelen adreslere körlemesine istek atılmasını (SSRF / yetkisiz host) engeller.
   */
  static validateHost(targetUrl: string, expectedEnvironment: FreeAgentEnvironment): URL {
    if (!targetUrl || typeof targetUrl !== 'string') {
      throw new BadRequestException('[FreeAgent URI] Geçersiz veya boş URL.');
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl.trim());
    } catch {
      throw new BadRequestException(`[FreeAgent URI] URL ayrıştırılamadı: ${targetUrl}`);
    }

    // Yalnızca HTTPS protokolüne izin verilir
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException(
        `[FreeAgent URI] Güvenlik ihlali: Sadece HTTPS protokolü desteklenir, gelen: ${parsed.protocol}`,
      );
    }

    const expectedHost = this.getExpectedHost(expectedEnvironment);

    // Host tam eşleşmeli, subdomain kaçışları veya yabancı hostlar reddedilir
    if (parsed.hostname.toLowerCase() !== expectedHost.toLowerCase()) {
      throw new BadRequestException(
        `[FreeAgent URI] Host güvenlik doğrulaması başarısız! Beklenen: '${expectedHost}', Gelen: '${parsed.hostname}'. Yabancı host'lara veya çapraz ortama istek atılamaz.`,
      );
    }

    return parsed;
  }

  /**
   * §5.1 URL'den veya metinden sayısal kaynak kimliğini çıkarır.
   * Ör: "https://api.freeagent.com/v2/contacts/42" -> "42"
   * Ör: "42" -> "42"
   * Ör: "https://api.sandbox.freeagent.com/v2/categories/001" -> "001"
   */
  static extractResourceId(fullUrlOrId: string | number, resourceType?: string): string {
    if (fullUrlOrId === undefined || fullUrlOrId === null) {
      throw new BadRequestException('[FreeAgent URI] Kaynak kimliği boş olamaz.');
    }

    const str = String(fullUrlOrId).trim();
    if (!str) {
      throw new BadRequestException('[FreeAgent URI] Kaynak kimliği boş olamaz.');
    }

    // Zaten saf ID ise (içinde slash ve iki nokta yoksa)
    if (!str.includes('/') && !str.includes(':')) {
      return str;
    }

    try {
      const url = new URL(str);
      const segments = url.pathname.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];

      if (resourceType) {
        const typeIndex = segments.indexOf(resourceType);
        if (typeIndex === -1 || typeIndex === segments.length - 1) {
          throw new BadRequestException(
            `[FreeAgent URI] URL '${resourceType}' kaynağı içermiyor: ${str}`,
          );
        }
        return segments[typeIndex + 1];
      }

      if (!lastSegment) {
        throw new BadRequestException(`[FreeAgent URI] URL segmenti geçersiz: ${str}`);
      }
      return lastSegment;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      // Göreli yol ise (ör. "contacts/42")
      const segments = str.split('/').filter(Boolean);
      return segments[segments.length - 1];
    }
  }

  /**
   * §5.1 Tek yardımcı: Ortam taban adresi ve kaynak ID'sinden tam FreeAgent URI'si kurar.
   * Mapper'larda elle string birleştirme (+ veya template literal) YASAKTIR.
   */
  static buildResourceUri(
    resourceType:
      | 'contacts'
      | 'invoices'
      | 'categories'
      | 'bank_accounts'
      | 'bank_transaction_explanations'
      | 'projects'
      | 'company'
      | 'users',
    idOrUrl: string | number,
    environment: FreeAgentEnvironment,
  ): string {
    const baseUrl = this.getBaseUrl(environment);

    if (resourceType === 'company') {
      return `${baseUrl}/company`;
    }

    const rawId = this.extractResourceId(idOrUrl, resourceType);
    return `${baseUrl}/${resourceType}/${encodeURIComponent(rawId)}`;
  }

  /**
   * §5.1 Bir URL'in geçerli ortamla eşleşip eşleşmediğini kontrol eder.
   * Sandbox'ta üretilmiş bir eşleme üretimde GEÇERSİZDİR; sessizce taşınamaz.
   */
  static isEnvironmentMatch(url: string, currentEnvironment: FreeAgentEnvironment): boolean {
    try {
      const expectedHost = this.getExpectedHost(currentEnvironment);
      const parsed = new URL(url.trim());
      return parsed.hostname.toLowerCase() === expectedHost.toLowerCase();
    } catch {
      return false;
    }
  }
}
