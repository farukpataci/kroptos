import { BadRequestException, Injectable } from '@nestjs/common';
import { decrypt, encrypt } from '../../../common/utils/encryption.util';
import { AccountingProviderSchema } from './AccountingTypes';
import { AccountingProviderRegistry } from './AccountingProviderRegistry';
import { isAgentLocal, isDerived, stripNonServerFields } from './AccountingCredentialSchema';

export { AccountingProviderSchema } from './AccountingTypes';

@Injectable()
export class AccountingCredentialService {
  decrypt(encryptedText: string): Record<string, any> {
    try {
      return JSON.parse(decrypt(encryptedText));
    } catch (error: any) {
      throw new BadRequestException(`Muhasebe kimlik bilgileri çözülemedi: ${error.message}`);
    }
  }

  encrypt(credentials: Record<string, any>): string {
    return encrypt(JSON.stringify(credentials ?? {}));
  }

  getSchema(provider: string): AccountingProviderSchema | undefined {
    if (AccountingProviderRegistry.has(provider)) {
      return AccountingProviderRegistry.get(provider).credentialSchema;
    }
    return undefined;
  }

  validate(provider: string, credentials: Record<string, any>): void {
    const schema = this.getSchema(provider);
    if (!schema) {
      throw new BadRequestException(`Desteklenmeyen muhasebe sağlayıcısı: ${provider}`);
    }

    // AGENT_LOCAL / derived alanlar sunucuya HİÇ gelmez (K2) — burada zorunlu sayılmaz
    const missing = schema.fields
      .filter((f) => f.required && !isAgentLocal(f) && !isDerived(f))
      .filter((f) => !String(credentials?.[f.key] ?? '').trim())
      .map((f) => f.key);

    if (missing.length > 0) {
      throw new BadRequestException(
        `${provider} için zorunlu alanlar eksik: ${missing.join(', ')}`,
      );
    }
  }

  /** K2 — şifrelemeden ÖNCE çağrılır: AGENT_LOCAL ve derived alanlar sunucu kaydına giremez. */
  stripNonServerFields(provider: string, credentials: Record<string, any> | undefined): Record<string, any> {
    const schema = this.getSchema(provider);
    return schema ? stripNonServerFields(schema, credentials) : { ...(credentials ?? {}) };
  }

  maskCredentials(provider: string, credentials: Record<string, any>): Record<string, any> {
    if (!credentials) return {};
    const schema = this.getSchema(provider);
    const masked: Record<string, any> = { ...credentials };

    if (schema) {
      for (const field of schema.fields) {
        if ((field.type === 'password' || field.secret) && masked[field.key]) {
          const val = String(masked[field.key]);
          masked[field.key] = val.length > 4 ? `****${val.slice(-4)}` : '****';
        }
      }
    } else {
      for (const key of Object.keys(masked)) {
        if (/secret|password|token|key/i.test(key) && !/channel|url/i.test(key)) {
          masked[key] = '****';
        }
      }
    }

    return masked;
  }
}
