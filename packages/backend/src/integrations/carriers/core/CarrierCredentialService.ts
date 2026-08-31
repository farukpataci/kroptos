import { BadRequestException, Injectable } from '@nestjs/common';
import { decrypt, encrypt } from '../../../common/utils/encryption.util';
import { CarrierProvider } from './CarrierTypes';

/**
 * Credentials each carrier cannot work without, per provider.
 *
 * The values are the field names the carrier's own documentation uses, so the
 * form, the connector and this check all say the same thing. Only providers
 * with a connector are listed: a provider with no entry is rejected outright
 * rather than accepted with whatever the client happened to send.
 *
 * ponytail: a plain map, not a manifest registry like the marketplace side.
 * Move to a manifest when the carrier UI needs field labels and types too.
 */
const REQUIRED_CREDENTIALS: Partial<Record<CarrierProvider, string[]>> = {
  // The mock has no upstream account, so it requires nothing.
  MOCK: [],
  HEPSIJET: ['userName', 'password', 'companyShortName'],
  YURTICI: ['wsUserName', 'wsPassword'],
  ARAS: ['userName', 'password', 'customerCode'],
  DHL: ['apiKey', 'apiSecret', 'accountNumber'],
  MNG: ['customerNumber', 'username', 'password'],
  SENDEO: ['username', 'password', 'customerCode'],
  PTT: ['username', 'password', 'customerCode'],
  DPD: ['apiKey', 'accountNumber'],
  SURAT: ['userName', 'password', 'customerCode'],
  GLS: ['username', 'password', 'shipperId'],
};

@Injectable()
export class CarrierCredentialService {
  /** Decrypts and parses what the CarrierIntegration row stores. */
  decrypt(encryptedText: string): Record<string, any> {
    try {
      return JSON.parse(decrypt(encryptedText));
    } catch (error: any) {
      throw new BadRequestException(`Taşıyıcı kimlik bilgileri çözülemedi: ${error.message}`);
    }
  }

  encrypt(credentials: Record<string, any>): string {
    return encrypt(JSON.stringify(credentials ?? {}));
  }

  /**
   * Checks every required field is present. Values are not inspected beyond
   * being non-blank — a well-formed but wrong secret is testConnection's job.
   */
  validate(provider: string, credentials: Record<string, any>): void {
    const key = provider.toUpperCase() as CarrierProvider;
    const required = REQUIRED_CREDENTIALS[key];

    if (!required) {
      throw new BadRequestException(`Desteklenmeyen taşıyıcı sağlayıcı: ${provider}`);
    }

    const missing = required.filter((field) => !String(credentials?.[field] ?? '').trim());
    if (missing.length > 0) {
      throw new BadRequestException(
        `${provider} için zorunlu kimlik bilgileri eksik: ${missing.join(', ')}`,
      );
    }
  }

  /** Which fields a form must collect for this provider. */
  requiredFields(provider: string): string[] {
    return REQUIRED_CREDENTIALS[provider.toUpperCase() as CarrierProvider] ?? [];
  }
}
