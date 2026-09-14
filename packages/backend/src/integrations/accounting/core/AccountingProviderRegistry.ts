import { BadRequestException } from '@nestjs/common';
import {
  AGENT_ROUTE_CAPABILITY_KEYS,
  AccountingProviderDescriptor,
  CORE_CAPABILITY_KEYS,
  CapabilityStatus,
} from './AccountingTypes';

export class AccountingProviderRegistry {
  private static readonly providers: Map<string, AccountingProviderDescriptor> = new Map();

  /**
   * Bozuk descriptor KAYIT ANINDA reddedilir (docs/mikro.agent.md GÖREV 2 kabul kriteri):
   * - çekirdek yetenek anahtarları tanımsız olamaz; supportedRoutes bildiren sağlayıcıda
   *   Agent-rotası anahtarlarının HEPSİ tanımlı olmalı
   * - lastVerifiedAt boşken supportsTest / supportsProduction = true olamaz
   * - readiness !== PRODUCTION_READY iken supportsProduction = true olamaz
   * Ağ isteği hiç yapmayan sağlayıcı (isOffline) doğrulama kurallarından muaftır — kural
   * "doğrulanmamış ağ isteği" içindir, dosya üretimi için değil.
   */
  static register(descriptor: AccountingProviderDescriptor): void {
    AccountingProviderRegistry.assertValid(descriptor);
    this.providers.set(descriptor.id.toUpperCase(), descriptor);
  }

  static assertValid(d: AccountingProviderDescriptor): void {
    const fail = (msg: string): never => {
      throw new Error(`[AccountingProviderRegistry] '${d?.id}' reddedildi: ${msg}`);
    };
    if (!d?.id || d.id !== d.id.toUpperCase()) fail('id büyük harf ve boş olmayan olmalı');
    if (!d.capabilities) fail('capabilities eksik');
    const valid = new Set<string>(Object.values(CapabilityStatus));
    for (const key of CORE_CAPABILITY_KEYS) {
      if (!valid.has((d.capabilities as any)[key])) fail(`capabilities.${key} tanımsız`);
    }
    if (d.supportedRoutes?.length) {
      for (const key of AGENT_ROUTE_CAPABILITY_KEYS) {
        if (!valid.has((d.capabilities as any)[key])) fail(`Agent rotası yeteneği tanımsız: ${key}`);
      }
    }
    if (!d.isOffline) {
      if ((d.supportsTest || d.supportsProduction) && !d.lastVerifiedAt) {
        fail('lastVerifiedAt boşken supportsTest/supportsProduction açılamaz');
      }
      if (d.supportsProduction && d.readiness !== 'PRODUCTION_READY') {
        fail(`readiness=${d.readiness} iken supportsProduction açılamaz`);
      }
    }
    // connectorClass burada denetlenmez: spec dosyalarında döngüsel import sırası yüzünden kayıt anında
    // henüz tanımsız olabilir; get() sonrası factory zaten `new` ile patlar.
  }

  static get(id: string): AccountingProviderDescriptor {
    const descriptor = this.providers.get(id.toUpperCase());
    if (!descriptor) {
      throw new BadRequestException(`Desteklenmeyen muhasebe sağlayıcısı: ${id}`);
    }
    return descriptor;
  }

  static has(id: string): boolean {
    return this.providers.has(id.toUpperCase());
  }

  static all(): AccountingProviderDescriptor[] {
    return Array.from(this.providers.values());
  }

  static clear(): void {
    this.providers.clear();
  }
}
