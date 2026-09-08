import { BadRequestException } from '@nestjs/common';
import { AccountingProviderDescriptor } from './AccountingTypes';

export class AccountingProviderRegistry {
  private static readonly providers: Map<string, AccountingProviderDescriptor> = new Map();

  static register(descriptor: AccountingProviderDescriptor): void {
    this.providers.set(descriptor.id.toUpperCase(), descriptor);
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
