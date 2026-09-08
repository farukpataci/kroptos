import { BadRequestException, Injectable } from '@nestjs/common';
import { decrypt, encrypt } from '../../../common/utils/encryption.util';

export interface CredentialFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'password';
  required: boolean;
  description?: string;
}

export interface AccountingProviderSchema {
  provider: string;
  name: string;
  fields: CredentialFieldDefinition[];
}

const PROVIDER_SCHEMAS: Record<string, AccountingProviderSchema> = {
  PARASUT: {
    provider: 'PARASUT',
    name: 'Paraşüt',
    fields: [
      { key: 'clientId', label: 'Client ID (Uygulama ID)', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret (İstemci Gizli Anahtarı)', type: 'password', required: true },
      { key: 'username', label: 'Kullanıcı Adı (E-posta)', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
      { key: 'companyId', label: 'Firma ID (Company ID)', type: 'text', required: true },
      { key: 'redirectUri', label: 'Redirect URI', type: 'text', required: false, description: 'urn:ietf:wg:oauth:2.0:oob (Varsayılan)' },
    ],
  },
};

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
    return PROVIDER_SCHEMAS[provider.toUpperCase()];
  }

  validate(provider: string, credentials: Record<string, any>): void {
    const schema = this.getSchema(provider);
    if (!schema) {
      throw new BadRequestException(`Desteklenmeyen muhasebe sağlayıcısı: ${provider}`);
    }

    const missing = schema.fields
      .filter((f) => f.required)
      .filter((f) => !String(credentials?.[f.key] ?? '').trim())
      .map((f) => f.key);

    if (missing.length > 0) {
      throw new BadRequestException(
        `${provider} için zorunlu alanlar eksik: ${missing.join(', ')}`,
      );
    }
  }

  maskCredentials(provider: string, credentials: Record<string, any>): Record<string, any> {
    if (!credentials) return {};
    const schema = this.getSchema(provider);
    const masked: Record<string, any> = { ...credentials };

    if (schema) {
      for (const field of schema.fields) {
        if (field.type === 'password' && masked[field.key]) {
          const val = String(masked[field.key]);
          masked[field.key] = val.length > 4 ? `****${val.slice(-4)}` : '****';
        }
      }
    } else {
      for (const key of Object.keys(masked)) {
        if (/secret|password|token/i.test(key)) {
          masked[key] = '****';
        }
      }
    }

    return masked;
  }
}
